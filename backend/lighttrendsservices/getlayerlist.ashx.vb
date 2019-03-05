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

Public Class getlayerlist1
    Implements System.Web.IHttpHandler

    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest
        '
        '
        '
        '
        'GETS THE UP TO DATE LIST OF LAYERS WITH METADATA
        'OUTPUT AS JSON
        '
        '
        '
        '
        Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())

            cn.Open()

            Using Cmd As New NpgsqlCommand("SELECT layername, rastercolumn, to_char(datestart, 'YYYY-MM-DD') as datestart, to_char(dateend, 'YYYY-MM-DD') as dateend, period, satellite, sattypes FROM public.lighttrends ORDER BY rastercolumn", cn)

                Using reader As NpgsqlDataReader = Cmd.ExecuteReader()

                    'JSON output
                    Dim sb As New StringBuilder()
                    Dim sw As New StringWriter(sb)

                    Dim output As String = ""

                    Using writer As JsonWriter = New JsonTextWriter(sw)
                        writer.WriteStartObject()


                        While reader.Read()
                            writer.WritePropertyName(reader(1))
                            writer.WriteStartObject()

                            writer.WritePropertyName("layername")
                            writer.WriteValue(reader(0))
                            writer.WritePropertyName("datestart")
                            writer.WriteValue(reader(2))
                            writer.WritePropertyName("dateend")
                            writer.WriteValue(reader(3))
                            writer.WritePropertyName("period")
                            writer.WriteValue(reader(4))
                            writer.WritePropertyName("satellite")
                            writer.WriteValue(reader(5))
                            writer.WritePropertyName("sattypes")
                            writer.WriteValue(reader(6))

                            writer.WriteEndObject()
                        End While


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
