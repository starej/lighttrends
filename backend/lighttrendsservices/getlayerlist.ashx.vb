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