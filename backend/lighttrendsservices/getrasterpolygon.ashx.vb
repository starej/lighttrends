'############################################################
'# 
'# Radiance Light Trends is a software for selecting regions of Earth and examining the trend in light emissions observed by satellite.
'# Copyright (C) 2019, German Research Centre for Geosciences <http://gfz-potsdam.de>. The application was programmed by Deneb, Geoinformation solutions, Jurij Stare s.p <starej@t-2.net>.
'# 
'# Parts of this program were developed within the context of the following publicly funded Project:
'# - ERA-PLANET (via GEOEssential project), European Union’s Horizon 2020 research and innovation programme grant agreement no. 689443 <http://www.geoessential.eu/>
'# 
'# Licensed under the EUPL, Version 1.2 or - as soon they will be approved by the European Commission - subsequent versions of the EUPL (the "Licence"), complemented with the following provision: For the scientific transparency and verification of results obtained and communicated to the public after using a modified version of the work, You (as the recipient of the source code and author of this modified version, used to produce the published results in scientific communications) commit to make this modified source code available in a repository that is easily and freely accessible for a duration of five years after the communication of the obtained results.
'# 
'# You may not use this work except in compliance with the Licence.
'# 
'# You may obtain a copy of the Licence at: https://joinup.ec.europa.eu/software/page/eupl
'# 
'# Unless required by applicable law or agreed to in writing, software distributed under the Licence is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licence for the specific language governing permissions and limitations under the Licence.
'# 
'############################################################
﻿Imports System.Web.Configuration
Imports Npgsql

Public Class getrasterpolygon
    Implements System.Web.IHttpHandler
    '
    '
    '
    '
    'GETS A POLYGON FROM PIXELS THAT UNDERGO STATISTICAL ANALYSIS
    'ACCEPTS HTTPS POST REQUEST
    'INPUT PARAMETERS:
    'geometry=[lon,lat|LINESTRING(lon,lat ... lon,lat)]; "LINESTRING(2 46,4 46,4 45,2 46,2 46)"
    'satellite=[viirs|dmsp]
    'mask=[none|mask_year00] optional
    '
    'OUTPUT AS JSON. POLYGON IN WKT FORMAT 
    '
    '
    '
    '
    '
    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest

        Dim geometry As String = context.Request.Form("geometry")
        'validate geometry parameter
        If geometry.IndexOf("POINT") < 0 And geometry.IndexOf("LINESTRING") < 0 Then
            context.Response.Write("{""error"": ""geometry not valid""}")
            Return
        Else
            Dim test As String = geometry.Replace("POINT", "").Replace("LINESTRING", "").Replace("(", "").Replace(")", "").Replace(",", "").Replace(" ", "").Replace(".", "").Replace("-", "")
            If Not Regex.IsMatch(test, "^[0-9 ]*$") Then
                context.Response.Write("{""error"": ""geometry not valid""}")
                Return
            End If
        End If

        Dim satellite As String = context.Request.Form("satellite")
        'validate satellite parameter
        If Not satellite = "dmsp" And Not satellite = "viirs" Then
            context.Response.Write("{""error"": ""sattelite not 'viirs' or 'dmsp'""}")
            Return
        End If

        'optional mask
        Dim mask As String = "none"
        If Not context.Request.Form("mask") = Nothing Then
            mask = context.Request.Form("mask")
            If Not Regex.IsMatch(mask.Replace("mask_", ""), "^[0-9]*$") Then
                context.Response.Write("{""error"": ""mask not valid""}")
                Return
            End If
        End If

        Dim rasterColumn1 As String = "viirs_npp_201600" 'has no nodata pixels
        Dim rasterColumn2 As String = "viirs_npp_201204" 'has index
        Dim result As String = ""
        Dim errorMessage As String = ""

        If satellite = "dmsp" Then
            rasterColumn1 = "dmsp_u_f101992" 'has index and no nodata pixels
            rasterColumn2 = "dmsp_u_f101992" 'has index and no nodata pixels
        End If

        If mask <> "none" Then
            rasterColumn1 = mask 'has index
            rasterColumn2 = mask 'has index
        End If

        Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
            cn.Open()

            Dim selectCmd As String = "SELECT ST_AsText(ST_unaryUnion(ST_Polygon(ST_Union(ST_Clip(" & rasterColumn1 & ", ST_SetSRID(ST_MakePolygon(ST_GeomFromText('" & geometry & "')),4326), TRUE))))) as geom FROM public." & satellite & " WHERE ST_Intersects(ST_SetSRID(ST_MakePolygon(ST_GeomFromText('" & geometry & "')),4326), " & rasterColumn2 & ")"
            Using Cmd As New NpgsqlCommand(selectCmd, cn)

                Try
                    Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                        While reader.Read()

                            result = reader(0).ToString


                        End While
                    End Using
                Catch ex As Exception
                    errorMessage = ex.Message

                End Try


            End Using



            cn.Close()

        End Using
        'write output

        context.Response.ContentType = "application/json"

        If errorMessage = "" Then
            context.Response.Write("{""geom"": """ & result & """}")
        Else
            context.Response.Write("{""error"": """ & errorMessage & """}")
        End If


    End Sub

    ReadOnly Property IsReusable() As Boolean Implements IHttpHandler.IsReusable
        Get
            Return False
        End Get
    End Property

End Class
