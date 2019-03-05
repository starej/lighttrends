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

Public Class exportchart
    Implements System.Web.IHttpHandler

    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest
        '
        '
        '
        '
        'EXPORTS CLIENT GENERATED SVG CHART IN DIFFERENT FORMATS.
        'CONVERSION IS DONE BY INKSCAPE.
        'ACCEPTS POSTED SVG FILE.
        'INPUT PARAMETERS:
        'format=[png|pdf|eps]
        '
        'OUTPUT AS PNG (raster), PDF (vector) or EPS (vector) file. 
        '
        '
        '
        '
        '
        'get output format
        Dim outputFormat As String = ""
        If Not context.Request.Form("format") = Nothing Then
            outputFormat = context.Request.Form("format")
        Else
            context.Response.Write("{""error"":""No format specified.""}")
            Return
        End If

        'get uploaded file
        Dim upload As HttpPostedFile
        Try
            upload = context.Request.Files("svg")
        Catch ex As Exception
            context.Response.Write("{""error"":""No .svg in post request.""}")
            Return
        End Try

        'directory to write input/output files
        Dim tmpDir As String = ConfigurationManager.AppSettings("tmpdir").ToString()

        'generate suffix for filename
        Dim suffix As String = generateRandomString()

        'rename uploaded svg file to svg_[random string].svg
        'and save it to temp directory.
        Dim SVGFilename As String = tmpDir & "svg_" & suffix & ".svg"
        Try
            upload.SaveAs(SVGFilename)
        Catch ex As Exception
            context.Response.Write("{""error"":""Save failed.""}")
        End Try

        'export
        Dim outputFileName As String = SVGFilename.Replace(".svg", "." & outputFormat).Replace("svg_", outputFormat & "_")
        If outputFormat = "png" Then
            updatelayers1.bashCommand("inkscape --export-dpi='150,150' --export-background='rgb(100%,100%,100%)' --export-background-opacity='1' --without-gui --export-png=" & outputFileName & " " & SVGFilename)
        ElseIf outputFormat = "pdf" Then
            updatelayers1.bashCommand("inkscape --file=" & SVGFilename & " --export-area-drawing --without-gui --export-pdf=" & outputFileName)
        ElseIf outputFormat = "eps" Then
            updatelayers1.bashCommand("inkscape " & SVGFilename & " -E " & outputFileName & " --export-ignore-filters --export-ps-level=3")
        End If

        context.Response.Write("{""link"":""tmp" & outputFileName.Substring(outputFileName.LastIndexOf("/")) & """}")

    End Sub

    ReadOnly Property IsReusable() As Boolean Implements IHttpHandler.IsReusable
        Get
            Return False
        End Get
    End Property

    'generates random 6 character string
    Public Shared Function generateRandomString() As String
        Dim s As String = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        Dim r As New Random
        Dim sb As New StringBuilder
        For i As Integer = 1 To 6
            Dim idx As Integer = r.Next(0, 62)
            sb.Append(s.Substring(idx, 1))
        Next
        Return sb.ToString()
    End Function

End Class
