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
﻿Imports System.Net
Imports System.Threading
Imports System.Web.Configuration
Imports Npgsql

Public Class updatelayers1
    Implements System.Web.IHttpHandler

    'set temp directory. www-data needs read/write permission to this directory.
    Dim tmpDir As String = ConfigurationManager.AppSettings("tmpdir").ToString()

    Sub ProcessRequest(ByVal context As HttpContext) Implements IHttpHandler.ProcessRequest

        '
        '
        '
        'SEARCHES NOAA WEBSITE FOR NEW LINKS:
        'https://ngdc.noaa.gov/eog/viirs/download_dnb_composites_iframe.html
        'IF NEW ENTRIES ARE FOUND, IT DOWNLOADS DATA AND UPDATES THE DATABASE (table public.viirs)
        '
        'IT TAKES A COUPLE OF HOURS TO COMPLETE THE OPERATION.
        'MOSTLY BECAUSE OF LIMITED DOWNLOAD SPEED FROM THE NOAA SERVER (ABOUT 3 GB NEEDS TO BE TRANSFERED),
        '
        '
        'BASIC STEPS FOR 1 GROUP OF 6 TILES ARE
        '1. Download HTML from NOAA website and extract links to vcmcfg tgz files
        '2. Compare the list to database content and compose a list for further process
        '3. Download tgz files and extract the contents
        '4. set pixels in radiance tiff to nodata (null) where no observations were conducted 
        '   (basically no data was collected) as those pixels have a value of 0 (zero) which is incorrect!
        '5. create a mosaic (public.temp_raster) from 6 tiles 
        '6. add mosaic to master raster table public.viirs
        '7. insert new record into table public.lighttrends containing layer metadata 
        '8. Project mosaic into EPSG:3857 projection, perform color reduction to save space, create overview piramyds and publish the layer in Geoserver
        '

        Try
            '
            'correct passphrase parameter sets off the update process if it is "idle"
            'passphrase=[string] is set in Web.config
            'reset=[true] parameter resets the status if it hangs during update
            '
            'Dim passphrase As String = context.Request.Form("passphrase")
            Dim passphrase As String = context.Request.QueryString("passphrase")
            Dim reset As String = context.Request.QueryString("reset")
            If reset = Nothing Then
                reset = "false"
            End If

            'get status of the update
            Dim status As List(Of String) = getStatus()

            'start update in a new thread if idle and passphrase is correct
            If status(0) = "idle" And passphrase = ConfigurationManager.AppSettings("passphrase").ToString() And reset = "false" Then
                Dim record_stat As New Thread(
                  Sub()
                      startUpdate()
                  End Sub
                )
                record_stat.Start()
                context.Response.Write("{""activity"": ""started update process"",""timestamp"":""" & Date.Now.ToString("yyyy-MM-dd HH:mm:ss") & """}")

            ElseIf status(0) <> "idle" And passphrase = ConfigurationManager.AppSettings("passphrase").ToString() And reset = "true" Then
                'resets status if it hangs for some reason
                setStatus("idle")
                context.Response.Write("{""activity"":""" & status(0) & """,""timestamp"":""" & Date.Now.ToString("yyyy-MM-dd HH:mm:ss") & """}")

            Else
                'outputs the current state of the update process
                context.Response.Write("{""activity"":""" & status(0) & """,""timestamp"":""" & status(1) & """}")
            End If

        Catch ex As Exception
            context.Response.Write("{""error"": """ & ex.Message & """,""timestamp"":""" & Date.Now.ToString("yyyy-MM-dd HH:mm:ss") & """}")
        End Try

    End Sub

    ReadOnly Property IsReusable() As Boolean Implements IHttpHandler.IsReusable
        Get
            Return False
        End Get
    End Property

    'checks and returns status of the update
    Private Function getStatus() As List(Of String)
        Dim status As New List(Of String)
        Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
            cn.Open()
            Using Cmd As New NpgsqlCommand("SELECT status, to_char(lastactive, 'YYYY-MM-DD HH24:MI:SS') FROM lighttrends_update_status WHERE id = 1", cn)
                Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                    While reader.Read()
                        status.Add(reader(0))
                        status.Add(reader(1))
                    End While
                End Using
            End Using
            cn.Close()
        End Using
        Return status
    End Function

    'updates status of the update
    Private Sub setStatus(status As String)
        Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
            cn.Open()
            Using Cmd As New NpgsqlCommand("UPDATE lighttrends_update_status set status=@status, lastactive = @lastactive WHERE id = 1", cn)
                Cmd.Parameters.AddWithValue("@status", status)
                Cmd.Parameters.AddWithValue("@lastactive", Date.Now())
                Cmd.ExecuteNonQuery()
            End Using
            cn.Close()
        End Using
    End Sub

    Protected Sub startUpdate()

        Try
            'recheck status
            Dim status As List(Of String) = getStatus()

            'stops and updates status if not idle
            If status(0) <> "idle" Then
                Return
            End If

            'clear all temporary data in tmp directory
            bashCommand("rm " & tmpDir & "*")

            'Checking wether to update
            'get links from VIIRS NOAA website
            Dim linksNOAA As List(Of String) = ExtractLinks(ConfigurationManager.AppSettings("noaa").ToString())


            'get layer names from lightrends database
            Dim listLightTrends As New List(Of String)

            Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                cn.Open()
                Using Cmd As New NpgsqlCommand("SELECT layername FROM public.lighttrends WHERE satellite = 'VIIRS'", cn)
                    Using reader As NpgsqlDataReader = Cmd.ExecuteReader()
                        While reader.Read()
                            listLightTrends.Add(reader(0))
                        End While
                    End Using
                End Using
                cn.Close()
            End Using

            'remove links that are already in the database
            For i As Integer = 0 To linksNOAA.Count - 1
                Dim link As String = linksNOAA(i)
                If listLightTrends.Contains(Mid(link, link.IndexOf("SVDNB_npp_20") + 1, 27)) Then
                    linksNOAA(i) = ""
                End If
            Next

            linksNOAA.RemoveAll(Function(o) o = "")

            'stops if nothing to update ie. no rows
            If linksNOAA.Count = 0 Then
                setStatus("idle")
                Return
            End If

            'just in case sort links to group them by name
            linksNOAA.Sort()

            For i As Integer = 0 To linksNOAA.Count - 1
                'select a group of 6 links and process them before moving to the next group
                Dim linksNOAA_6pack As New List(Of String)
                linksNOAA_6pack.Add(linksNOAA(i))
                linksNOAA_6pack.Add(linksNOAA(i + 1))
                linksNOAA_6pack.Add(linksNOAA(i + 2))
                linksNOAA_6pack.Add(linksNOAA(i + 3))
                linksNOAA_6pack.Add(linksNOAA(i + 4))
                linksNOAA_6pack.Add(linksNOAA(i + 5))

                rasterProcess(linksNOAA_6pack)
                i = i + 5
            Next

        Catch ex As Exception
            setStatus(ex.Message)
        End Try


    End Sub

    Private Sub rasterProcess(linksNOAA As List(Of String))


        'download compressed .tgz files
        For i As Integer = 0 To linksNOAA.Count - 1
            Dim TGZfilename As String = linksNOAA(i).Substring(linksNOAA(i).LastIndexOf("/") + 1)
            setStatus("downloading " & i + 1 & ". tgz file: " & TGZfilename)
            bashCommand("wget " & linksNOAA(i) & " -O " & tmpDir & TGZfilename)
        Next

        'create alist of extracted tiffs
        Dim radianceTiffs As New List(Of String)
        Dim observationTiffs As New List(Of String)

        'Extract avg radiance tiffs, remove tgz
        For i As Integer = 0 To linksNOAA.Count - 1
            Dim TGZfilename As String = linksNOAA(i).Substring(linksNOAA(i).LastIndexOf("/") + 1)

            setStatus("extracting " & i + 1 & ". radiance tiff from: " & TGZfilename)
            'annual tgz contains ALL configurations. Only vcm is needed.
            Dim radianceTiffFilename As String = ""
            If TGZfilename.IndexOf("_vcmcfg_") > 0 Then
                'monthly
                radianceTiffFilename = bashCommand("tar -xvzf " & tmpDir & TGZfilename & " -C " & tmpDir & " --wildcards '*.avg_rade*'")
            Else
                radianceTiffFilename = bashCommand("tar -xvzf " & tmpDir & TGZfilename & " -C " & tmpDir & " --wildcards '*_vcm_*avg_rade*'")
            End If



            setStatus("extracting " & i + 1 & ". observation tiff from: " & TGZfilename)
            Dim observationTiffFilename As String = bashCommand("tar -xvzf " & tmpDir & TGZfilename & " -C " & tmpDir & " --wildcards '*.cf_cvg*'")

            'get resulting tiff filenames into the lists needed in the next step
            radianceTiffs.Add(radianceTiffFilename.Replace(vbCr, "").Replace(vbLf, "").Replace("./", "").Trim())
            observationTiffs.Add(observationTiffFilename.Replace(vbCr, "").Replace(vbLf, "").Replace("./", "").Trim())
        Next

        'for testing purposes...
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_00N060E_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_00N060E_vcmcfg_v10_c201605121456.cf_cvg.tif")
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_00N060W_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_00N060W_vcmcfg_v10_c201605121456.cf_cvg.tif")
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_00N180W_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_00N180W_vcmcfg_v10_c201605121456.cf_cvg.tif")
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_75N060E_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_75N060E_vcmcfg_v10_c201605121456.cf_cvg.tif")
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_75N060W_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_75N060W_vcmcfg_v10_c201605121456.cf_cvg.tif")
        'radianceTiffs.Add("SVDNB_npp_20120401-20120430_75N180W_vcmcfg_v10_c201605121456.avg_rade9h.tif")
        'observationTiffs.Add("SVDNB_npp_20120401-20120430_75N180W_vcmcfg_v10_c201605121456.cf_cvg.tif")


        'needs to be sorted by name when mosaicking, so join update in 2. step works correctly
        radianceTiffs.Sort()
        observationTiffs.Sort()

        Dim layerName As String = ""
        Dim tileCounter As Integer = 0
        For i As Integer = 0 To radianceTiffs.Count - 1
            'count tiles
            tileCounter += 1
            Dim radianceTiffFilename As String = radianceTiffs(i)
            Dim observationTiffFilename As String = observationTiffs(i)

            'generate raster column name for monthly "viirs_[SatName]_YYYYMM" and annual "viirs_[SatName]_YYYY00"
            Dim viirsPeriod1 As String = "monthly"
            Dim rasterColumnName As String = "viirs_" & Mid(radianceTiffFilename, 7, 3) & "_" & Mid(radianceTiffFilename, 11, 6)

            'annual viirs has _vcm_ string in its filename
            If radianceTiffFilename.IndexOf("_vcm_") > -1 Then
                viirsPeriod1 = "annual"
                rasterColumnName = "viirs_" & Mid(radianceTiffFilename, 7, 3) & "_" & Mid(radianceTiffFilename, 11, 4) & "00"
            End If

            'set pixels with no observations to nodata
            setStatus("Setting nodata on " & tileCounter & ". radiance tiff: " & radianceTiffFilename)
            bashCommand("gdal_calc.py -A " & tmpDir & radianceTiffFilename & " -B " & tmpDir & observationTiffFilename & " --outfile=" & tmpDir & i & "output_nodata.tif --calc='(A*(B>0))+((-3.40282346638529e+038)*(B<=0))' --NoDataValue=-3.40282346638529e+038 --overwrite --quiet")
            'Also set all negative values to 0 (zero)
            'bashCommand("gdal_calc.py -A " & tmpDir & radianceTiffFilename & " -B " & tmpDir & observationTiffFilename & " --outfile=" & tmpDir & i & "output_nodata.tif --calc='(((A*(A>0))+(0*(A<0)))*(B>0))+((-3.40282346638529e+038)*(B<=0))' --NoDataValue=-3.40282346638529e+038 --overwrite --quiet")


            'if this is a first tile of a group of 6 rasters, then create (overwrite) new temp_rast table or append to current
            'a = append
            'd = create with overwrite
            Dim action As String = "a"
            If tileCounter = 1 Then
                action = "d"
                'layerName cosists of first 27 characters ie. "SVDNB_npp_20120601-20120630"
                layerName = Left(radianceTiffFilename, 27)
            End If

            'run raster2pgsql from bash to load raster
            setStatus("mosaicking " & tileCounter & ". " & "radiance tiff: " & radianceTiffFilename)

            'input nodata correcter tiff instead of original radiance tiff
            bashCommand("raster2pgsql -s 4326 -" & action & " -b 1 -N -3.40282346638529e+038 " & tmpDir & i & "output_nodata.tif -t 64x64 public.temp_rast | PGPASSWORD=" & ConfigurationManager.AppSettings("pgpass").ToString() & " psql -U " & ConfigurationManager.AppSettings("pguser").ToString() & " PostGIS > /dev/null")


            'add raster column to public.viirs master table
            If tileCounter = 1 Then
                'try to add in case it already exists
                Try
                    Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                        cn.Open()
                        Using Cmd As New NpgsqlCommand("ALTER TABLE public.viirs ADD COLUMN " & rasterColumnName & " raster", cn)
                            Cmd.ExecuteNonQuery()
                        End Using
                        cn.Close()
                    End Using
                Catch ex As Exception

                End Try

            ElseIf tileCounter = 6 Then
                'when last tile in the group
                'update master table public.viirs with data from rast_temp table when all 6 tiles are mosaicked in the temp_rast table
                setStatus("updating master raster table with mosaic:  " & layerName)
                Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                    cn.Open()
                    Using Cmd As New NpgsqlCommand("UPDATE public.viirs b SET " & rasterColumnName & " = a.rast FROM temp_rast a WHERE a.rid = b.rid", cn)
                        Cmd.ExecuteNonQuery()
                    End Using
                    cn.Close()
                End Using

                'insert new record into table containing layer metadata public.lighttrends
                setStatus("inserting new metada record into public.lighttrends table of layer: " & layerName)
                Using cn As New NpgsqlConnection(WebConfigurationManager.ConnectionStrings("PostGIScon").ToString())
                    cn.Open()
                    Using Cmd As New NpgsqlCommand("INSERT INTO public.lighttrends (layername, rastercolumn, datestart, dateend, period, satellite, sattypes) VALUES " _
                            & " ('" & layerName & "','" & rasterColumnName & "','" & Mid(layerName, 11, 4) & "-" & Mid(layerName, 15, 2) & "-" & Mid(layerName, 17, 2) & "','" _
                            & Mid(layerName, 20, 4) & "-" & Mid(layerName, 24, 2) & "-" & Mid(layerName, 26, 2) & "','" & viirsPeriod1 & "','VIIRS','" & Mid(layerName, 7, 3) & "')", cn)
                        Cmd.ExecuteNonQuery()
                    End Using
                    cn.Close()
                End Using

                'publish layer for display in Geoserver

                'create virtual mosaic from all 6 tiles
                bashCommand("gdalbuildvrt " & tmpDir & "master.virt " & tmpDir & "0output_nodata.tif " & tmpDir & "1output_nodata.tif " & tmpDir & "2output_nodata.tif " & tmpDir & "3output_nodata.tif " & tmpDir & "4output_nodata.tif " & tmpDir & "5output_nodata.tif ")
                'reproject raster to spherical mercator projection EPSG:3857
                setStatus("publishing layer to Geoserver - reprojecting: " & layerName)
                bashCommand("gdalwarp -co COMPRESS=LZW -co INTERLEAVE=PIXEL -co BIGTIFF=YES -q -multi -r bilinear -ts 65536 36866 -srcnodata -3.40282346638529e+038 -dstnodata -3.40282346638529e+038 -s_srs epsg:4326 -t_srs epsg:3857 " & tmpDir & "master.virt " & tmpDir & "master.tif")
                'create colormap file.
                bashCommand("printf '10000 255 255 255\n200 250 250 250\n100 242 242 242\n80 232 232 232\n60 212 212 212\n40 192 192 192\n20 160 160 160\n6 128 128 128\n3 96 96 96\n1 64 64 64\n0.75 56 56 56\n0.45 48 48 48\n0.35 25 25 25\n0.25 15 15 15\n0.2 10 10 10\n0.1 5 5 5\n-2 1 1 1\nnv 0 0 0' > " & tmpDir & "colorGreyscale.txt")
                'colormap the layer (file size reduction).
                setStatus("publishing layer to Geoserver - coloring: " & layerName)
                bashCommand("gdaldem color-relief -nearest_color_entry " & tmpDir & "master.tif " & tmpDir & "colorGreyscale.txt " & tmpDir & "master2.tif")
                'set nodata value
                setStatus("publishing layer to Geoserver - setting nodata: " & layerName)
                bashCommand("gdal_translate -a_nodata 0 -co COMPRESS=LZW -co TILED=YES -co INTERLEAVE=PIXEL -co NUM_THREADS=8 " & tmpDir & "master2.tif " & tmpDir & rasterColumnName & ".tif")
                'create overviews for faster view
                setStatus("publishing layer to Geoserver - creating overviews: " & layerName)
                bashCommand("gdaladdo -r average --config COMPRESS_OVERVIEW LZW " & tmpDir & rasterColumnName & ".tif 2 4 8 16 32 64 128")
                'move tif to geoserver directory ~data_dir/data/ . www-data needs write access to this directory.
                bashCommand("mv " & tmpDir & rasterColumnName & ".tif /usr/share/geoserver/data_dir/data/")
                'give read permission for Geoserver to read the file.
                bashCommand("chmod o+r /usr/share/geoserver/data_dir/data/" & rasterColumnName & ".tif")
                'create data store in geoserver using REST
                bashCommand("curl -u " & ConfigurationManager.AppSettings("pguser").ToString() & ":" & ConfigurationManager.AppSettings("pgpass").ToString() & " -H 'Content-Type:application/xml' -X POST -d '<coverageStore><name>" & rasterColumnName & "</name><type>GeoTIFF</type><url>file:data/" & rasterColumnName & ".tif</url><workspace>lighttrends</workspace><enabled>true</enabled></coverageStore>' http://localhost:8080/geoserver/rest/workspaces/lighttrends/coveragestores")
                'publish layer in geoserver and do not advertise it
                bashCommand("curl -u " & ConfigurationManager.AppSettings("pguser").ToString() & ":" & ConfigurationManager.AppSettings("pgpass").ToString() & " -H 'Content-Type:application/xml' -X POST -d '<coverage><name>" & rasterColumnName & "</name><title>" & rasterColumnName & "</title><enabled>true</enabled><advertised>false</advertised><srs>EPSG:3857</srs><parameters><entry><string>InputTransparentColor</string><string>#000000</string></entry></parameters><dimensions><coverageDimension><name>RED_BAND</name><description>GridSampleDimension[-Infinity,Infinity]</description><range><min>-inf</min><max>inf</max></range><dimensionType><name>UNSIGNED_8BITS</name></dimensionType></coverageDimension><coverageDimension><name>GREEN_BAND</name><description>GridSampleDimension[-Infinity,Infinity]</description><range><min>-inf</min><max>inf</max></range><dimensionType><name>UNSIGNED_8BITS</name></dimensionType></coverageDimension><coverageDimension><name>BLUE_BAND</name><description>GridSampleDimension[-Infinity,Infinity]</description><range><min>-inf</min><max>inf</max></range><dimensionType><name>UNSIGNED_8BITS</name></dimensionType></coverageDimension></dimensions></coverage>' http://localhost:8080/geoserver/rest/workspaces/lighttrends/coveragestores/" & rasterColumnName & "/coverages")
                'add styles and interpolation method 
                bashCommand("curl -u " & ConfigurationManager.AppSettings("pguser").ToString() & ":" & ConfigurationManager.AppSettings("pgpass").ToString() & " -H 'Content-type: application/xml' -X PUT -d '<layer><defaultStyle><name>viirs_c1</name></defaultStyle><styles><style>raster</style><style>viirs_c1</style><style>viirs_cb1</style></styles><defaultWMSInterpolationMethod>Nearest</defaultWMSInterpolationMethod></layer>' http://localhost:8080/geoserver/rest/workspaces/lighttrends/layers/" & rasterColumnName)

            End If
        Next

        'delete all temporary data in tmp directory
        setStatus("cleaning up tmp files")
        bashCommand("rm " & tmpDir & "*")

        'end
        setStatus("idle")
    End Sub

    'downloads NOAA HTML page and returns a list of links to vcmcfg tgz files
    Private Function ExtractLinks(ByVal url As String) As List(Of String)
        Dim list As New List(Of String)

        Dim wc As New WebClient
        Dim html As String = wc.DownloadString(url)
        Dim links As MatchCollection = Regex.Matches(html, "<a.*?href=""(.*?)"".*?>(.*?)</a>")

        For Each match As Match In links
            Dim matchUrl As String = match.Groups(1).Value
            'get only tgz files
            If matchUrl.IndexOf(".tgz") > 0 Then
                'discard tgz with vcmslcfg config (only taking vcmcfg and annual)
                If Not matchUrl.IndexOf("vcmslcfg") > 0 Then
                    list.Add(matchUrl)
                End If
            End If
        Next

        Return list
    End Function

    Public Shared Function bashCommand(cmd As String) As String

        Dim process = New Process() With {
                .StartInfo = New ProcessStartInfo With {
                    .FileName = "/bin/bash",
                    .Arguments = "-c """ & cmd & """",
                    .RedirectStandardOutput = True,
                    .UseShellExecute = False,
                    .CreateNoWindow = True
                    }
                }
        process.Start()
        Dim result As String = process.StandardOutput.ReadToEnd()
        process.WaitForExit()
        Return result
    End Function
End Class
