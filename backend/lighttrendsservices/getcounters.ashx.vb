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
Imports System.IO
Imports System.Web.Configuration
Imports Newtonsoft.Json
Imports Npgsql
Imports NpgsqlTypes

Public Class setcounter
    Implements System.Web.IHttpHandler

    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest
        '
        '
        '
        'GETS STATISTICAL COUNTERS FOR
        'CSV, POINT AND AREA REQUESTS
        'AGGREGATION CAN BE "day", "week", "month", "year" or "all"
        'OPTIONAL PARAMETERS limit and offset for paging
        '
        '
        '

        Dim aggType As String = context.Request.QueryString("aggregation")
        Dim aggTypeValue() As String = {"day", "week", "month", "year", "all"}


        Dim limit As String = context.Request.QueryString("limit")
        Dim offset As String = context.Request.QueryString("offset")

        'default values for limit and offset
        If limit Is Nothing Then
            limit = 10000
        End If
        If offset Is Nothing Then
            offset = 0
        End If

        'check if aggregation is a valid parameter
        If aggType = Nothing Then
            context.Response.Write("{""error"":""'aggregation' parameter missing! Can be 'day', 'week', 'month', 'year' or 'all'""}")
            Return
        End If

        If Not aggTypeValue.Contains(aggType) Then
            context.Response.Write("{""error"":""'aggregation' parameter is not one of 'day', 'week', 'month', 'year' or 'all'""}")
            Return
        End If

        Dim SQL As String = ""
        If aggType = "all" Then
            SQL = "SELECT to_char(min(date), 'YYYY-MM-DD') || ' - ' || to_char(max(date), 'YYYY-MM-DD') AS total, SUM(point) as point, SUM(area) as area, SUM(csv) as csv FROM public.lighttrends_counters OFFSET @offset LIMIT @limit"
        Else
            SQL = "SELECT to_char(date_trunc('" & aggType & "', date::date), 'YYYY-MM-DD') AS " & aggType & ", SUM(point) as point, SUM(area) as area, SUM(csv) as csv FROM public.lighttrends_counters GROUP BY " & aggType & " ORDER by " & aggType & " DESC OFFSET @offset LIMIT @limit"
        End If

        Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())

            cn.Open()

            Using Cmd As New NpgsqlCommand(SQL, cn)
                Cmd.Parameters.AddWithValue("@offset", CInt(offset))
                Cmd.Parameters.AddWithValue("@limit", CInt(limit))
                Using reader As NpgsqlDataReader = Cmd.ExecuteReader()

                    'JSON output
                    Dim sb As New StringBuilder()
                    Dim sw As New StringWriter(sb)

                    Dim output As String = ""

                    Using writer As JsonWriter = New JsonTextWriter(sw)
                        writer.WriteStartObject()
                        writer.WritePropertyName("counters")
                        writer.WriteStartArray()

                        While reader.Read()
                            writer.WriteStartObject()
                            writer.WritePropertyName(reader.GetName(0))
                            writer.WriteValue(reader(0))
                            writer.WritePropertyName(reader.GetName(1))
                            writer.WriteValue(CInt(reader(1)))
                            writer.WritePropertyName(reader.GetName(2))
                            writer.WriteValue(CInt(reader(2)))
                            writer.WritePropertyName(reader.GetName(3))
                            writer.WriteValue(CInt(reader(3)))
                            writer.WriteEnd()
                        End While

                        writer.WriteEndArray()
                        writer.WriteEndObject()
                    End Using

                    output = sw.ToString
                    context.Response.Write(output)
                End Using

            End Using
            cn.Close()
        End Using
    End Sub

    ReadOnly Property IsReusable() As Boolean Implements IHttpHandler.IsReusable
        Get
            Return False
        End Get
    End Property

End Class
