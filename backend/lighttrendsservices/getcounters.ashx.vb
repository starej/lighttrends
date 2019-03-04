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