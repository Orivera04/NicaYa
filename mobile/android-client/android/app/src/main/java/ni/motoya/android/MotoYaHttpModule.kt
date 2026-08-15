package ni.motoya.android

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MotoYaHttpModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "MotoYaHttp"

  @ReactMethod
  fun request(url: String, method: String, headers: ReadableMap, body: String?, promise: Promise) {
    Thread {
      var connection: HttpURLConnection? = null
      try {
        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          requestMethod = method
          connectTimeout = 30_000
          readTimeout = 30_000
          useCaches = false
          instanceFollowRedirects = true
          headers.toHashMap().forEach { (key, value) -> setRequestProperty(key, value?.toString().orEmpty()) }
          if (body != null && method != "GET") {
            doOutput = true
            OutputStreamWriter(outputStream, Charsets.UTF_8).use { it.write(body) }
          }
        }
        val status = connection.responseCode
        val stream = if (status >= 400) connection.errorStream else connection.inputStream
        val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
        promise.resolve(Arguments.createMap().apply { putInt("status", status); putString("body", text) })
      } catch (error: Exception) {
        promise.reject("NATIVE_HTTP_ERROR", error.message, error)
      } finally {
        connection?.disconnect()
      }
    }.start()
  }
}