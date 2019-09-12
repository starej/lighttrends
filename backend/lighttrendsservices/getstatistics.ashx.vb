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
Imports System.Threading
Imports System.Web.Configuration
Imports Newtonsoft.Json
Imports Npgsql
Imports ClosedXML.Excel
Imports System.Threading.Tasks
Imports System.ComponentModel

Public Class getstatistics
    Implements System.Web.IHttpHandler

    Dim watch As Stopwatch
    Private bgwl As List(Of BackgroundWorker) = New List(Of BackgroundWorker)()
    Dim outputColumns As New List(Of String)
    Dim outputValuesPoint As New List(Of String)
    Dim outputValuesArea As New List(Of String)
    Dim outputArea As Double
    Dim outputAreaMaxPixels As Int64
    Dim nonLTappWKT As Boolean = False

    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest
        '
        '
        '
        '
        'GETS STATISTICS FOR SPECIFIED RASTERS
        'ACCEPTS HTTPS POST REQUEST
        'INPUT PARAMETERS:
        'format=[json|csv]
        'querytypet=[point|area]
        'rastercolumns=[semicolon seperated list of raster columns]; ie. "dmsp_u_f101992;dmsp_u_f101993;dmsp_u_f101994"
        'mask=[none|mask_year00] optional
        'geometry=[lon,lat|WKT LINESTRING, POLYGON and MULTIPOLYGON geometry]; "14.5,45.5" or "LINESTRING(2 46,4 46,4 45,2 46,2 46)" or MULTIPOLYGON(((2 46,4 46,4 45,2 46,2 46)),((6 46,8 46,8 45,6 46,6 46))); (view WKT syntax at: https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry)
        '
        'OUTPUT AS JSON OR CSV (format=[json|csv])
        '
        '
        '
        '
        '

        'start stopwatch
        watch = System.Diagnostics.Stopwatch.StartNew()

        'INPUT PARAMETERS

        'csv, excel or json (default)
        Dim outputFormat As String = "json"
        If Not context.Request.Form("format") = Nothing Then
            outputFormat = context.Request.Form("format")
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


        'point or area
        Dim queryType As String = context.Request.Form("querytype")


        'list of rasters
        'ie. "dmsp_u_f101992;dmsp_u_f101993;dmsp_u_f101994"
        Dim rasterColumns As String = context.Request.Form("rastercolumns")

        'point or enclosed linestring
        'examples for point and area respectivly (lon lat pairs)
        '14.5,45.5
        'LINESTRING(2 46,4 46,4 45,2 46,2 46)
        Dim inputGeometry As String = context.Request.Form("geometry")
        If queryType = Nothing Or rasterColumns = Nothing Or inputGeometry = Nothing Then
            Return
        End If

        'validate inputGeometry parameter
        If queryType = "area" Then

            'validate WKT with PostGIS
            Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                cn.Open()
                Using Cmd As New NpgsqlCommand("SELECT ST_GeomFromText(@wkt)", cn)
                    Cmd.Parameters.AddWithValue("@wkt", inputGeometry)

                    Try
                        Dim valid = Cmd.ExecuteNonQuery()
                    Catch ex As Exception
                        context.Response.Write("{""error"": ""geometry not valid. Hint: " & ex.Data("Hint").replace("""", "'") & " ""}")
                        cn.Close()
                        Return
                    End Try

                End Using
                cn.Close()

                'only support POLYGON and MULTIPOLYGON geometries
                'if linestring is supplied, assume it's a polygon geometry and convert it 
                If inputGeometry.IndexOf("LINESTRING") > -1 Then
                    inputGeometry = inputGeometry.Replace("LINESTRING", "POLYGON(") & ")"
                End If

                If inputGeometry.IndexOf("POLYGON") < 0 Then
                    context.Response.Write("{""error"": ""geometry not valid. Hint: area query only supports POLYGON and MULTIPOLYGON geometries""}")
                    Return
                End If


            End Using
        Else
            'point
            Dim testInputGeometry As String = inputGeometry.Replace(",", "").Replace(" ", "").Replace(".", "").Replace("-", "")
            If Not Regex.IsMatch(testInputGeometry, "^[0-9 ]*$") Then
                context.Response.Write("{""error"": ""geometry not valid""}")
                Return
            End If
        End If

        'validate rastercolumns parameter
        Dim testRastercolumns As String = rasterColumns.Replace(";", "")
        If Not Regex.IsMatch(testRastercolumns, "^[a-zA-Z0-9_]*$") Then
            context.Response.Write("{""error"": ""Rastercolumns not valid""}")
            Return
        End If

        'prepare rasterColumns input for select statements
        Dim rasterColumnsArray = rasterColumns.Split(";")
        Array.Sort(rasterColumnsArray)

        Dim DMSPselectColumns As New List(Of String)
        Dim VIIRSselectColumns As New List(Of String)
        Dim whereDMSP As String = ""
        Dim whereVIIRS As String = ""

        If queryType = "point" Then

            For Each column As String In rasterColumnsArray
                If column.IndexOf("viirs") > -1 Then
                    If mask <> "none" Then
                        VIIRSselectColumns.Add("ST_Value(ST_MapAlgebra(" & column & ", " & mask & ", '[rast1] * [rast2.val]'), ST_SetSRID(ST_MakePoint(" & inputGeometry & "), 4326)) as " & column)
                    Else
                        VIIRSselectColumns.Add("ST_Value(" & column & ", ST_SetSRID(ST_MakePoint(" & inputGeometry & "), 4326)) as " & column)
                    End If
                End If
                If column.IndexOf("dmsp") > -1 Then
                    DMSPselectColumns.Add("ST_Value(" & column & ", ST_SetSRID(ST_MakePoint(" & inputGeometry & "), 4326)) as " & column)
                End If
            Next
            whereVIIRS = " FROM public.viirs WHERE ST_Intersects(ST_SetSRID(ST_MakePoint(" & inputGeometry & "), 4326), viirs_npp_201204)"
            whereDMSP = " FROM public.dmsp WHERE ST_Intersects(ST_SetSRID(ST_MakePoint(" & inputGeometry & "), 4326), dmsp_u_f101992)"

        ElseIf queryType = "area" Then

            For Each column As String In rasterColumnsArray
                If column.IndexOf("viirs") > -1 Then

                    If mask <> "none" Then
                        VIIRSselectColumns.Add("ST_SummaryStatsAgg(ST_Clip(ST_MapAlgebra(" & column & ", " & mask & ", '[rast1] * [rast2.val]'), ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), TRUE), 1, TRUE, 1) as " & column)
                    Else
                        VIIRSselectColumns.Add("ST_SummaryStatsAgg(ST_Clip(" & column & ", ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), TRUE), 1, TRUE, 1) as " & column)
                    End If

                End If
                If column.IndexOf("dmsp") > -1 Then
                    DMSPselectColumns.Add("ST_SummaryStatsAgg(ST_Clip(" & column & ", ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), TRUE), 1, TRUE, 1) as " & column)
                End If
            Next

            whereVIIRS = " FROM public.viirs WHERE ST_Intersects(ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), viirs_npp_201204)"
            whereDMSP = " FROM public.dmsp WHERE ST_Intersects(ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), dmsp_u_f101992)"

            'gets area and pixels in selected area for use in weighted area ouput
            Dim areaArr As List(Of Double) = getArea(inputGeometry, whereDMSP, whereVIIRS, rasterColumns)
            outputArea = areaArr(0)
            outputAreaMaxPixels = areaArr(1)
        End If




        Dim queryResults As New List(Of List(Of String))

        Dim result As New Object
        If queryType = "area" Then
            'performance gain            
            result = splitWorkResult(queryType, DMSPselectColumns, VIIRSselectColumns, whereDMSP, whereVIIRS)
        ElseIf queryType = "point" Then
            result = executePgQueries(queryType, DMSPselectColumns, VIIRSselectColumns, whereDMSP, whereVIIRS)
        End If

        For i As Integer = 0 To result(0).count - 1
            outputColumns.Add(result(0)(i))
            If queryType = "point" Then
                outputValuesPoint.Add(result(1)(i))
            Else
                outputValuesArea.Add(result(1)(i))
            End If
        Next


        'initialize output
        Dim output As String = ""

        Try
            output = createOutput(queryType, outputFormat)
        Catch ex As Exception
            output = "{""error"":""" & ex.Message & """}"
        End Try

        'record request for statistics purposes in database table lighttrends_counters
        statCounter(queryType, outputFormat)

        'write output
        If outputFormat = "json" Then
            context.Response.ContentType = "application/json"
        ElseIf outputFormat = "csv" Then
            context.Response.ContentType = "application/csv"
        ElseIf outputFormat = "excel" Then
            context.Response.ContentType = "application/excel"
        End If

        context.Response.Write(output)
    End Sub

    Private Sub statCounter(queryType As String, outputFormat As String)
        Dim record_stat As New Thread(
          Sub()
              'count csv, point, area requests seperately
              Dim type As String = queryType
              If outputFormat <> "json" Then
                  type = "csv"
              End If

              Dim successUpdate As Integer = 0
              Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                  cn.Open()
                  Try
                      'try to update first
                      Using Cmd As New NpgsqlCommand("UPDATE lighttrends_counters SET " & type & " = " & type & " +1 WHERE date = @date", cn)
                          Cmd.Parameters.AddWithValue("@date", Date.Today)
                          successUpdate = Cmd.ExecuteNonQuery()
                      End Using

                      'if update fails (first record for current day), create a new record first
                      If successUpdate = 0 Then
                          Using Cmd As New NpgsqlCommand("INSERT INTO lighttrends_counters (csv, point, area, date) VALUES (0,0,0,@date) ", cn)
                              Cmd.Parameters.AddWithValue("@date", Date.Today)
                              Cmd.ExecuteNonQuery()
                          End Using

                          Using Cmd As New NpgsqlCommand("UPDATE lighttrends_counters SET " & type & " = " & type & " +1 WHERE date = @date", cn)
                              Cmd.Parameters.AddWithValue("@date", Date.Today)
                              Cmd.ExecuteNonQuery()
                          End Using

                      End If

                  Catch ex As Exception

                  End Try
                  cn.Close()
              End Using
          End Sub
        )
        record_stat.Start()
    End Sub
    Private Function createOutput(queryType As String, outputFormat As String) As String
        Dim output As String = "{""error"":""Invalid request. Check geometry.""}"
        If outputColumns.Count > 0 Then

            If queryType = "area" Then
                'sort lists first

                Dim outputMerge As New List(Of String)
                For i As Integer = 0 To outputColumns.Count - 1
                    outputMerge.Add(outputColumns(i) & ";" & outputValuesArea(i))
                Next

                outputMerge.Sort()
                outputColumns.Clear()
                outputValuesArea.Clear()

                For i As Integer = 0 To outputMerge.Count - 1
                    Dim a As Array = outputMerge(i).Split(";")
                    outputColumns.Add(a(0))
                    outputValuesArea.Add(a(1))
                Next
            End If

            'area of a pixel at equator in sq. km
            Dim maxPixelArea As Double = 0.215139
            Dim isVIIRS As Boolean = True
            For i As Integer = 0 To outputColumns.Count - 1
                If outputColumns(i).IndexOf("dmsp") > -1 Then
                    isVIIRS = False
                    Exit For
                End If
            Next

            'dmsp pixel is twice as large
            If isVIIRS = False Then
                maxPixelArea = 0.860556
            End If

            If outputFormat = "json" Then
                'JSON output
                Dim sb As New StringBuilder()
                Dim sw As New StringWriter(sb)


                Using writer As JsonWriter = New JsonTextWriter(sw)
                    writer.WriteStartObject()
                    writer.WritePropertyName("statistics")
                    writer.WriteStartObject()


                    For i As Integer = 0 To outputColumns.Count - 1
                        writer.WritePropertyName(outputColumns(i))
                        If queryType = "point" Then
                            'handle null/nothing
                            If outputValuesPoint(i) = Nothing Then
                                writer.WriteNull()
                            Else
                                writer.WriteValue(Double.Parse(outputValuesPoint(i)))
                            End If

                        ElseIf queryType = "area" Then
                            Dim dynObj = JsonConvert.DeserializeObject(outputValuesArea(i))
                            Dim count As Int32 = Convert.ToInt32(dynObj("count").ToString.Replace("{", "").Replace("}", ""))

                            'handle null/nothing
                            If count > 0 Then
                                Dim sum As Double = Convert.ToDouble(dynObj("sum").ToString.Replace("{", "").Replace("}", ""))
                                Dim mean As Double = Convert.ToDouble(dynObj("mean").ToString.Replace("{", "").Replace("}", ""))
                                Dim sum_area_weighted As Double = Math.Round(Convert.ToDouble(dynObj("sum").ToString.Replace("{", "").Replace("}", "")) * ((outputArea / outputAreaMaxPixels) / maxPixelArea), 2)

                                writer.WriteStartArray()
                                writer.WriteValue(count)
                                writer.WriteValue(Math.Round(sum, 2))
                                writer.WriteValue(Math.Round(mean, 5))
                                writer.WriteValue(sum_area_weighted)
                                writer.WriteEndArray()
                            Else
                                writer.WriteStartArray()
                                writer.WriteNull()
                                writer.WriteNull()
                                writer.WriteNull()
                                writer.WriteNull()
                                writer.WriteEndArray()

                            End If

                        End If

                    Next

                    writer.WriteEnd()


                    'end stopwatch
                    watch.[Stop]()

                    writer.WritePropertyName("result time")
                    writer.WriteValue(watch.ElapsedMilliseconds / 1000 & " seconds")

                    writer.WriteEndObject()
                End Using

                output = sw.ToString
            ElseIf outputFormat = "csv" Then
                'CSV ouput
                output = "rasterColumn,count,sum,mean" & vbCrLf

                If queryType = "point" Then
                    output = "rasterColumn,value" & vbCrLf

                    For i As Integer = 0 To outputColumns.Count - 1
                        output += outputColumns(i) & "," & outputValuesPoint(i) & vbCrLf
                    Next

                ElseIf queryType = "area" Then
                    output = "rasterColumn,count,sum,mean,sum_area_weighted" & vbCrLf

                    For i As Integer = 0 To outputColumns.Count - 1

                        output += outputColumns(i) & ","

                        Dim dynObj = JsonConvert.DeserializeObject(outputValuesArea(i))
                        Dim count As Int32 = Convert.ToInt32(dynObj("count").ToString.Replace("{", "").Replace("}", ""))


                        If count > 0 Then

                            Dim sum As Double = Convert.ToDouble(dynObj("sum").ToString.Replace("{", "").Replace("}", ""))
                            sum = Math.Round(sum, 2)

                            Dim mean As Double = Convert.ToDouble(dynObj("mean").ToString.Replace("{", "").Replace("}", ""))
                            mean = Math.Round(mean, 5)

                            Dim sum_area_weighted As Double = Math.Round(Convert.ToDouble(dynObj("sum").ToString.Replace("{", "").Replace("}", "")) * ((outputArea / outputAreaMaxPixels) / maxPixelArea), 2)

                            output += count & "," & sum & "," & mean & "," & sum_area_weighted & vbCrLf
                        Else
                            output += ",," & vbCrLf
                        End If

                    Next

                End If

            ElseIf outputFormat = "excel" Then

                Dim suffix As String = exportchart.generateRandomString()
                Dim filename As String = "Data_" & suffix & ".xlsx"
                Dim filepath As String = ConfigurationManager.AppSettings("tmpdir").ToString() & filename

                Using wb As XLWorkbook = New XLWorkbook()
                    'make new worksheet
                    wb.Worksheets.Add("lighttrends")

                    'select first worksheet
                    Dim worksheet = wb.Worksheets.First()
                    'Dim range = worksheet.RangeUsed()

                    'header
                    worksheet.Cell(1, 1).Value = "rasterColumn"
                    worksheet.Cell(1, 2).Value = "value"
                    If queryType = "point" Then

                        For i As Integer = 0 To outputColumns.Count - 1
                            'rasterColumn column
                            worksheet.Cell(i + 2, 1).Value = outputColumns(i)
                            'value column
                            Dim tempDbl As Double
                            If Double.TryParse(outputValuesPoint(i), tempDbl) Then
                                worksheet.Cell(i + 2, 2).Value = tempDbl
                            End If
                        Next
                    ElseIf queryType = "area" Then
                        'headers
                        worksheet.Cell(1, 2).Value = "count"
                        worksheet.Cell(1, 3).Value = "sum"
                        worksheet.Cell(1, 4).Value = "mean"
                        worksheet.Cell(1, 5).Value = "sum_area_weighted"

                        For i As Integer = 0 To outputColumns.Count - 1
                            'rasterColumn column
                            worksheet.Cell(i + 2, 1).Value = outputColumns(i)
                            'stat columns (count, sum, mean)
                            Dim dynObj = JsonConvert.DeserializeObject(outputValuesArea(i))
                            Dim count As Int32 = Convert.ToInt32(dynObj("count").ToString.Replace("{", "").Replace("}", ""))

                            If count > 0 Then
                                Dim sum As Double = Convert.ToDouble(dynObj("sum").ToString.Replace("{", "").Replace("}", ""))
                                Dim mean As Double = Convert.ToDouble(dynObj("mean").ToString.Replace("{", "").Replace("}", ""))
                                worksheet.Cell(i + 2, 2).Value = count
                                worksheet.Cell(i + 2, 3).Value = Math.Round(sum, 2)
                                worksheet.Cell(i + 2, 4).Value = Math.Round(mean, 5)
                                worksheet.Cell(i + 2, 5).Value = Math.Round(sum * ((outputArea / outputAreaMaxPixels) / maxPixelArea), 2)
                            End If
                        Next
                    End If

                    'resize columns to view all data
                    worksheet.Columns().AdjustToContents()

                    'save xlsx
                    wb.SaveAs(filepath)
                End Using

                'link to file
                output = "tmp/" & filename

            End If
        End If


        Return output
    End Function

    Private Function splitWorkResult(queryType As String, DMSPselectColumns As List(Of String), VIIRSselectColumns As List(Of String), whereDMSP As String, whereVIIRS As String) As Object

        Dim columns As New List(Of String)
        Dim values As New List(Of String)

        'distribute workload to maxThreads
        Dim maxNumberOfThreads As Integer = 8
        Dim numberOfThreads As Integer = 1 'min
        Dim numerOfDMSPThreads As Integer = 0
        Dim numerOfVIIRSThreads As Integer = 0

        Dim numberOfrasterColumns As Integer = DMSPselectColumns.Count + VIIRSselectColumns.Count

        'calculate number of threads to use
        If numberOfrasterColumns > 8 Then
            numberOfThreads = maxNumberOfThreads
            If DMSPselectColumns.Count > 0 And VIIRSselectColumns.Count > 0 Then
                numerOfDMSPThreads = Math.Round(maxNumberOfThreads * (DMSPselectColumns.Count / (DMSPselectColumns.Count + VIIRSselectColumns.Count)))
                numerOfVIIRSThreads = Math.Round(maxNumberOfThreads * (VIIRSselectColumns.Count / (DMSPselectColumns.Count + VIIRSselectColumns.Count)))

                If numerOfDMSPThreads = 0 Then
                    numerOfDMSPThreads += 1
                    numerOfVIIRSThreads -= 1
                End If
                If numerOfVIIRSThreads = 0 Then
                    numerOfDMSPThreads -= 1
                    numerOfVIIRSThreads += 1
                End If
            Else
                If DMSPselectColumns.Count = 0 Then
                    numerOfDMSPThreads = 0
                    numerOfVIIRSThreads = maxNumberOfThreads
                Else
                    numerOfVIIRSThreads = 0
                    numerOfDMSPThreads = maxNumberOfThreads
                End If
            End If
        Else
            numberOfThreads = numberOfrasterColumns
            numerOfDMSPThreads = DMSPselectColumns.Count
            numerOfVIIRSThreads = VIIRSselectColumns.Count
        End If

        'split list to numerOfDMSPThreads parts
        Dim DMSPselectColumnsSplit As List(Of List(Of String)) = splitList(numerOfDMSPThreads, DMSPselectColumns)
        Dim VIIRSselectColumnsSplit As List(Of List(Of String)) = splitList(numerOfVIIRSThreads, VIIRSselectColumns)

        Dim DMSPTasks(numerOfDMSPThreads - 1) As Task(Of Object)
        For i As Integer = 0 To numerOfDMSPThreads - 1
            Dim empylist As New List(Of String)
            Dim ii As Integer = i
            DMSPTasks(i) = Task(Of Object).Factory.StartNew(Function() executePgQueries("area", DMSPselectColumnsSplit(ii), empylist, whereDMSP, ""))
        Next

        Dim VIIRSTasks(numerOfVIIRSThreads - 1) As Task(Of Object)
        For i As Integer = 0 To numerOfVIIRSThreads - 1
            Dim empylist As New List(Of String)
            Dim ii As Integer = i
            VIIRSTasks(i) = Task(Of Object).Factory.StartNew(Function() executePgQueries("area", VIIRSselectColumnsSplit(ii), empylist, whereVIIRS, ""))
        Next

        Task.WaitAll(VIIRSTasks)

        Task.WaitAll(DMSPTasks)

        For i As Integer = 0 To DMSPTasks.Count - 1
            Dim taskResult As Object = DMSPTasks(i).Result
            For j As Integer = 0 To taskResult(0).count - 1
                columns.Add(taskResult(0)(j))
                values.Add(taskResult(1)(j))
            Next
        Next

        For i As Integer = 0 To VIIRSTasks.Count - 1
            Dim taskResult As Object = VIIRSTasks(i).Result
            For j As Integer = 0 To taskResult(0).count - 1
                columns.Add(taskResult(0)(j))
                values.Add(taskResult(1)(j))
            Next
        Next

        'wait for all to finish work
        Dim result As Object() = {columns, values}
        Return result
    End Function

    Public Function splitList(ByVal chunks As Integer, ByVal columns As List(Of String)) As List(Of List(Of String))
        Dim dds As New List(Of List(Of String)) '

        If chunks > 0 Then
            For i As Integer = 0 To chunks - 1
                Dim newdd As New List(Of String)
                dds.Add(newdd)
            Next

            For i As Integer = 0 To chunks - 1
                For j As Integer = 0 To Math.Floor(columns.Count / chunks) - 1
                    Try
                        dds(i).Add(columns(j + (i * Math.Floor(columns.Count / chunks))))
                    Catch ex As Exception

                    End Try

                Next
            Next

            columns.RemoveRange(0, Math.Floor(columns.Count / chunks) * chunks)

            For i As Integer = 0 To columns.Count - 1
                dds(i).Add(columns(i))
            Next
        End If


        Return dds
    End Function

    Private Function executePgQueries(queryType As String, DMSPselectColumns As List(Of String), VIIRSselectColumns As List(Of String), whereDMSP As String, whereVIIRS As String) As Object
        Dim columns As New List(Of String)
        Dim values As New List(Of String)

        Try
            Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                cn.Open()
                'DMSP query
                If DMSPselectColumns.Count > 0 Then
                    Using Cmd As New NpgsqlCommand("SELECT " & String.Join(",", DMSPselectColumns) & whereDMSP, cn)

                        Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                            While reader.Read()
                                For i As Integer = 0 To reader.FieldCount - 1
                                    columns.Add(reader.GetName(i))
                                    If queryType = "point" Then
                                        If IsDBNull(reader.GetValue(i)) Then
                                            'writes null for json and nothing for csv if DBNull
                                            values.Add(Nothing)
                                        Else
                                            If reader.GetName(i).IndexOf("_c_") > -1 Then
                                                'round to two decimals if calibrated dmsp, 
                                                'as uncalibrated has only integer values
                                                values.Add(Math.Round(reader.GetValue(i), 2))
                                            Else
                                                values.Add(reader.GetValue(i))
                                            End If

                                        End If
                                    Else queryType = "area"
                                        Try
                                            values.Add(JsonConvert.SerializeObject(reader(i)))
                                        Catch ex As Exception
                                            values.Add("{}")
                                        End Try
                                    End If


                                Next
                            End While
                        End Using

                    End Using
                End If

                'VIIRS query
                If VIIRSselectColumns.Count > 0 Then
                    Using Cmd As New NpgsqlCommand("SELECT " & String.Join(",", VIIRSselectColumns) & whereVIIRS, cn)

                        Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                            While reader.Read()
                                For i As Integer = 0 To reader.FieldCount - 1
                                    columns.Add(reader.GetName(i))

                                    If queryType = "point" Then
                                        If IsDBNull(reader.GetValue(i)) Then
                                            'writes null for json and nothing for csv if DBNull
                                            values.Add(Nothing)
                                        Else
                                            values.Add(Math.Round(reader.GetValue(i), 2))
                                        End If
                                    Else queryType = "area"
                                        Try
                                            values.Add(JsonConvert.SerializeObject(reader(i)))
                                        Catch ex As Exception
                                            values.Add("{}")
                                        End Try
                                    End If

                                Next
                            End While
                        End Using

                    End Using
                End If
                cn.Close()
            End Using
        Catch ex As Exception

        End Try


        Dim result As Object() = {columns, values}

        Return result
    End Function

    Private Function getArea(inputGeometry As String, whereDMSP As String, whereVIIRS As String, rasterColumns As String) As List(Of Double)
        Dim result As New List(Of Double)

        Dim whereString As String = ""
        Dim rasterIndex As String = "viirs_npp_201500"
        If rasterColumns.IndexOf("viirs") >= 0 Then
            whereString = whereVIIRS
        Else
            whereString = whereDMSP
            rasterIndex = "dmsp_u_f101992"
        End If
        Try
            Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                cn.Open()

                Using Cmd As New NpgsqlCommand("SELECT ST_area(ST_SetSrid(ST_geomfromText('" & inputGeometry & "'), 4326), true) / 1000000 as area, " _
                    & "(ST_SummaryStatsAgg(ST_Clip(" & rasterIndex & ", ST_SetSRID(ST_GeomFromText('" & inputGeometry & "'),4326), TRUE), 1, TRUE, 1)).count as pixels " & whereString, cn)

                    Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                        While reader.Read()
                            result.Add(reader.GetValue(0))
                            result.Add(reader.GetValue(1))
                        End While
                    End Using

                End Using
                cn.Close()
            End Using
        Catch ex As Exception

        End Try

        Return result
    End Function

    ReadOnly Property IsReusable() As Boolean Implements IHttpHandler.IsReusable
        Get
            Return False
        End Get
    End Property

End Class