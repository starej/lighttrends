Imports System.Web.Configuration
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