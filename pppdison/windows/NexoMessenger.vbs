' ============================================================
' Nexo Messenger - VBS GUI Application
' Полноценное приложение с графическим интерфейсом
' ============================================================

Option Explicit

Dim WshShell, FSO, AppPath, ServerURL, ServerPort
Dim IE, IsLoggedIn, CurrentUser
Dim LoginWindow, ChatWindow

' Initialize
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get application path
AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Configuration
ServerURL = "http://localhost:3001"
ServerPort = "3001"

' Check for saved server URL
On Error Resume Next
Dim savedURL
savedURL = WshShell.RegRead("HKCU\Software\NexoMessenger\ServerURL\")
If Err.Number = 0 And savedURL <> "" Then
    ServerURL = savedURL
End If
Err.Clear
On Error GoTo 0

' Show login window
ShowLoginWindow

' ============================================================
' Login Window
' ============================================================
Sub ShowLoginWindow
    Dim htmlLogin
    
    htmlLogin = "<!DOCTYPE html>" & vbCrLf & _
    "<html lang='ru'>" & vbCrLf & _
    "<head>" & vbCrLf & _
    "  <meta charset='UTF-8'>" & vbCrLf & _
    "  <meta http-equiv='X-UA-Compatible' content='IE=edge'>" & vbCrLf & _
    "  <title>Nexo Messenger - Вход</title>" & vbCrLf & _
    "  <style>" & vbCrLf & _
    "    * { margin: 0; padding: 0; box-sizing: border-box; }" & vbCrLf & _
    "    body { " & vbCrLf & _
    "      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;" & vbCrLf & _
    "      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);" & vbCrLf & _
    "      min-height: 100vh;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      align-items: center;" & vbCrLf & _
    "      justify-content: center;" & vbCrLf & _
    "      color: #eee;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .container {" & vbCrLf & _
    "      width: 900px;" & vbCrLf & _
    "      height: 600px;" & vbCrLf & _
    "      background: #1a1a2e;" & vbCrLf & _
    "      border-radius: 20px;" & vbCrLf & _
    "      box-shadow: 0 20px 60px rgba(0,0,0,0.5);" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      overflow: hidden;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .left-panel {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      background: linear-gradient(135deg, #6366f1, #8b5cf6);" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      flex-direction: column;" & vbCrLf & _
    "      align-items: center;" & vbCrLf & _
    "      justify-content: center;" & vbCrLf & _
    "      padding: 40px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .logo {" & vbCrLf & _
    "      font-size: 48px;" & vbCrLf & _
    "      font-weight: bold;" & vbCrLf & _
    "      margin-bottom: 10px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .tagline {" & vbCrLf & _
    "      font-size: 16px;" & vbCrLf & _
    "      opacity: 0.9;" & vbCrLf & _
    "      margin-bottom: 30px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .features { list-style: none; text-align: left; }" & vbCrLf & _
    "    .features li {" & vbCrLf & _
    "      margin: 10px 0;" & vbCrLf & _
    "      font-size: 14px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .right-panel {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      background: #1a1a2e;" & vbCrLf & _
    "      padding: 40px;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      flex-direction: column;" & vbCrLf & _
    "      justify-content: center;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    h2 { margin-bottom: 20px; color: #6366f1; }" & vbCrLf & _
    "    .tabs { display: flex; margin-bottom: 20px; }" & vbCrLf & _
    "    .tab {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      padding: 12px;" & vbCrLf & _
    "      text-align: center;" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "      border: 1px solid #333;" & vbCrLf & _
    "      cursor: pointer;" & vbCrLf & _
    "      transition: all 0.3s;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .tab.active {" & vbCrLf & _
    "      background: linear-gradient(135deg, #6366f1, #8b5cf6);" & vbCrLf & _
    "      border-color: #6366f1;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    input { " & vbCrLf & _
    "      width: 100%; " & vbCrLf & _
    "      padding: 15px; " & vbCrLf & _
    "      margin: 8px 0; " & vbCrLf & _
    "      border-radius: 10px; " & vbCrLf & _
    "      border: 1px solid #333; " & vbCrLf & _
    "      background: #16213e; " & vbCrLf & _
    "      color: #eee; " & vbCrLf & _
    "      font-size: 14px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    button { " & vbCrLf & _
    "      width: 100%; " & vbCrLf & _
    "      padding: 15px; " & vbCrLf & _
    "      margin: 10px 0; " & vbCrLf & _
    "      border-radius: 10px; " & vbCrLf & _
    "      border: none; " & vbCrLf & _
    "      font-size: 16px; " & vbCrLf & _
    "      font-weight: 600; " & vbCrLf & _
    "      cursor: pointer;" & vbCrLf & _
    "      background: linear-gradient(135deg, #6366f1, #8b5cf6);" & vbCrLf & _
    "      color: white;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    button:hover { opacity: 0.9; }" & vbCrLf & _
    "    button:disabled { opacity: 0.5; cursor: not-allowed; }" & vbCrLf & _
    "    .btn-secondary {" & vbCrLf & _
    "      background: #333;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .server-settings {" & vbCrLf & _
    "      margin-top: 20px;" & vbCrLf & _
    "      padding-top: 20px;" & vbCrLf & _
    "      border-top: 1px solid #333;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .server-settings label {" & vbCrLf & _
    "      font-size: 12px;" & vbCrLf & _
    "      color: #888;" & vbCrLf & _
    "      margin-bottom: 5px;" & vbCrLf & _
    "      display: block;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .error { color: #ff4444; margin: 10px 0; font-size: 13px; }" & vbCrLf & _
    "    .success { color: #00ff88; margin: 10px 0; font-size: 13px; }" & vbCrLf & _
    "    .hidden { display: none; }" & vbCrLf & _
    "  </style>" & vbCrLf & _
    "</head>" & vbCrLf & _
    "<body>" & vbCrLf & _
    "  <div class='container'>" & vbCrLf & _
    "    <div class='left-panel'>" & vbCrLf & _
    "      <div class='logo'>⚡ Nexo</div>" & vbCrLf & _
    "      <div class='tagline'>Современный мессенджер</div>" & vbCrLf & _
    "      <ul class='features'>" & vbCrLf & _
    "        <li>✅ Мгновенные сообщения</li>" & vbCrLf & _
    "        <li>📁 Хранение файлов в Telegram</li>" & vbCrLf & _
    "        <li>🔒 Безопасность и шифрование</li>" & vbCrLf & _
    "        <li>📱 Мультиплатформенность</li>" & vbCrLf & _
    "      </ul>" & vbCrLf & _
    "    </div>" & vbCrLf & _
    "    <div class='right-panel'>" & vbCrLf & _
    "      <div class='tabs'>" & vbCrLf & _
    "        <div class='tab active' onclick='showLogin()'>🔑 Вход</div>" & vbCrLf & _
    "        <div class='tab' onclick='showRegister()'>📝 Регистрация</div>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "      <div id='loginForm'>" & vbCrLf & _
    "        <h2>Вход в аккаунт</h2>" & vbCrLf & _
    "        <input type='text' id='loginUsername' placeholder='Username' autocomplete='off'>" & vbCrLf & _
    "        <input type='password' id='loginPassword' placeholder='Пароль'>" & vbCrLf & _
    "        <div id='loginError' class='error'></div>" & vbCrLf & _
    "        <button onclick='doLogin()'>Войти</button>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "      <div id='registerForm' class='hidden'>" & vbCrLf & _
    "        <h2>Регистрация</h2>" & vbCrLf & _
    "        <input type='text' id='regUsername' placeholder='Username (латиница)' autocomplete='off'>" & vbCrLf & _
    "        <input type='text' id='regDisplayname' placeholder='Отображаемое имя'>" & vbCrLf & _
    "        <input type='password' id='regPassword' placeholder='Пароль (мин. 6 символов)'>" & vbCrLf & _
    "        <div id='regError' class='error'></div>" & vbCrLf & _
    "        <div id='regSuccess' class='success'></div>" & vbCrLf & _
    "        <button onclick='doRegister()'>Создать аккаунт</button>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "      <div class='server-settings'>" & vbCrLf & _
    "        <label>🌐 URL сервера:</label>" & vbCrLf & _
    "        <input type='text' id='serverUrl' value='" & ServerURL & "'>" & vbCrLf & _
    "        <button class='btn-secondary' onclick='saveServerUrl()'>Сохранить</button>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "    </div>" & vbCrLf & _
    "  </div>" & vbCrLf & _
    "  <script>" & vbCrLf & _
    "    function showLogin() {" & vbCrLf & _
    "      document.getElementById('loginForm').classList.remove('hidden');" & vbCrLf & _
    "      document.getElementById('registerForm').classList.add('hidden');" & vbCrLf & _
    "      document.querySelectorAll('.tab')[0].classList.add('active');" & vbCrLf & _
    "      document.querySelectorAll('.tab')[1].classList.remove('active');" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function showRegister() {" & vbCrLf & _
    "      document.getElementById('loginForm').classList.add('hidden');" & vbCrLf & _
    "      document.getElementById('registerForm').classList.remove('hidden');" & vbCrLf & _
    "      document.querySelectorAll('.tab')[1].classList.add('active');" & vbCrLf & _
    "      document.querySelectorAll('.tab')[0].classList.remove('active');" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function doLogin() {" & vbCrLf & _
    "      var username = document.getElementById('loginUsername').value;" & vbCrLf & _
    "      var password = document.getElementById('loginPassword').value;" & vbCrLf & _
    "      if (!username || !password) {" & vbCrLf & _
    "        document.getElementById('loginError').textContent = 'Заполните все поля';" & vbCrLf & _
    "        return;" & vbCrLf & _
    "      }" & vbCrLf & _
    "      window.external.doLogin(username, password);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function doRegister() {" & vbCrLf & _
    "      var username = document.getElementById('regUsername').value;" & vbCrLf & _
    "      var displayName = document.getElementById('regDisplayname').value;" & vbCrLf & _
    "      var password = document.getElementById('regPassword').value;" & vbCrLf & _
    "      window.external.doRegister(username, displayName, password);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function saveServerUrl() {" & vbCrLf & _
    "      var url = document.getElementById('serverUrl').value;" & vbCrLf & _
    "      window.external.saveServerUrl(url);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function onLoginSuccess(token, user) {" & vbCrLf & _
    "      window.external.onLoginSuccess(token, user);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function onError(message) {" & vbCrLf & _
    "      document.getElementById('loginError').textContent = message;" & vbCrLf & _
    "      document.getElementById('regError').textContent = message;" & vbCrLf & _
    "    }" & vbCrLf & _
    "  </script>" & vbCrLf & _
    "</body>" & vbCrLf & _
    "</html>"
    
    ' Create IE window
    Set IE = CreateObject("InternetExplorer.Application")
    IE.Width = 920
    IE.Height = 640
    IE.Left = (CreateObject("WScript.Shell").Environment("Process")("ScreenWidth") \ 2) - 460
    IE.Top = (CreateObject("WScript.Shell").Environment("Process")("ScreenHeight") \ 2) - 320
    IE.Toolbar = False
    IE.StatusBar = False
    IE.Resizable = False
    IE.Navigate "about:blank"
    IE.Visible = True
    
    ' Wait for IE to load
    Do While IE.Busy Or IE.ReadyState <> 4
        WScript.Sleep 100
    Loop
    
    ' Write HTML
    IE.Document.Write htmlLogin
    IE.Document.Close
    
    ' Set object for external calls
    Set IE.external = New LoginExternal
    
    ' Wait for login
    IsLoggedIn = False
    Do While Not IsLoggedIn And IE.Visible
        WScript.Sleep 500
    Loop
    
    If Not IsLoggedIn Then
        WScript.Quit
    End If
End Sub

' ============================================================
' Login External Class
' ============================================================
Class LoginExternal
    Public Sub doLogin(username, password)
        Dim http, response, url
        url = ServerURL & "/api/auth/login"
        
        On Error Resume Next
        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.Open "POST", url, False
        http.SetRequestHeader "Content-Type", "application/json"
        http.Send "{""username"":""" & username & """,""password"":""" & password & """}"
        
        If Err.Number <> 0 Then
            IE.Document.getElementById("loginError").textContent = "Ошибка подключения к серверу"
            Err.Clear
            Exit Sub
        End If
        On Error GoTo 0
        
        If http.Status = 200 Then
            Dim json
            Set json = ParseJSON(http.ResponseText)
            
            If json.Exists("token") Then
                CurrentUser = username
                IsLoggedIn = True
                
                ' Save token
                WshShell.RegWrite "HKCU\Software\NexoMessenger\Token\", json("token"), "REG_SZ"
                WshShell.RegWrite "HKCU\Software\NexoMessenger\User\", username, "REG_SZ"
                
                ' Close login window and show chat
                IE.Visible = False
                ShowChatWindow json("token"), username
            Else
                IE.Document.getElementById("loginError").textContent = "Неверный username или пароль"
            End If
        Else
            IE.Document.getElementById("loginError").textContent = "Неверный username или пароль"
        End If
    End Sub
    
    Public Sub doRegister(username, displayName, password)
        Dim http, url
        url = ServerURL & "/api/auth/register"
        
        If Len(username) < 3 Then
            IE.Document.getElementById("regError").textContent = "Username минимум 3 символа"
            Exit Sub
        End If
        
        If Len(password) < 6 Then
            IE.Document.getElementById("regError").textContent = "Пароль минимум 6 символов"
            Exit Sub
        End If
        
        On Error Resume Next
        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.Open "POST", url, False
        http.SetRequestHeader "Content-Type", "application/json"
        http.Send "{""username"":""" & username & """,""displayName"":""" & displayName & """,""password"":""" & password & """}"
        
        If Err.Number <> 0 Then
            IE.Document.getElementById("regError").textContent = "Ошибка подключения к серверу"
            Err.Clear
            Exit Sub
        End If
        On Error GoTo 0
        
        If http.Status = 200 Or http.Status = 201 Then
            IE.Document.getElementById("regSuccess").textContent = "Аккаунт создан! Теперь войдите"
            IE.Document.getElementById("regError").textContent = ""
            WScript.Sleep 1000
            ' Switch to login
            IE.Document.parentWindow.execScript "showLogin()"
        Else
            Dim errorMsg
            errorMsg = "Ошибка регистрации"
            On Error Resume Next
            Dim respJson
            Set respJson = ParseJSON(http.ResponseText)
            If respJson.Exists("error") Then
                errorMsg = respJson("error")
            End If
            On Error GoTo 0
            IE.Document.getElementById("regError").textContent = errorMsg
        End If
    End Sub
    
    Public Sub saveServerUrl(url)
        ServerURL = url
        WshShell.RegWrite "HKCU\Software\NexoMessenger\ServerURL\", url, "REG_SZ"
        MsgBox "URL сервера сохранён: " & url, vbInformation, "Nexo Messenger"
    End Sub
    
    Public Sub onLoginSuccess(token, user)
        IsLoggedIn = True
    End Sub
End Class

' ============================================================
' Chat Window
' ============================================================
Sub ShowChatWindow(token, username)
    Dim htmlChat
    
    htmlChat = "<!DOCTYPE html>" & vbCrLf & _
    "<html lang='ru'>" & vbCrLf & _
    "<head>" & vbCrLf & _
    "  <meta charset='UTF-8'>" & vbCrLf & _
    "  <meta http-equiv='X-UA-Compatible' content='IE=edge'>" & vbCrLf & _
    "  <title>Nexo Messenger - " & username & "</title>" & vbCrLf & _
    "  <style>" & vbCrLf & _
    "    * { margin: 0; padding: 0; box-sizing: border-box; }" & vbCrLf & _
    "    body {" & vbCrLf & _
    "      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;" & vbCrLf & _
    "      background: #1a1a2e;" & vbCrLf & _
    "      color: #eee;" & vbCrLf & _
    "      height: 100vh;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      flex-direction: column;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .header {" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "      padding: 15px 20px;" & vbCrLf & _
    "      border-bottom: 1px solid #333;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      align-items: center;" & vbCrLf & _
    "      justify-content: space-between;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .header h1 { font-size: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }" & vbCrLf & _
    "    .header-buttons { display: flex; gap: 10px; }" & vbCrLf & _
    "    .header button {" & vbCrLf & _
    "      padding: 8px 15px;" & vbCrLf & _
    "      border-radius: 8px;" & vbCrLf & _
    "      border: none;" & vbCrLf & _
    "      cursor: pointer;" & vbCrLf & _
    "      font-size: 13px;" & vbCrLf & _
    "      font-weight: 500;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .btn-refresh { background: #6366f1; color: white; }" & vbCrLf & _
    "    .btn-logout { background: #333; color: #eee; }" & vbCrLf & _
    "    .content {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      overflow: hidden;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .sidebar {" & vbCrLf & _
    "      width: 300px;" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "      border-right: 1px solid #333;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      flex-direction: column;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .search-box {" & vbCrLf & _
    "      padding: 15px;" & vbCrLf & _
    "      border-bottom: 1px solid #333;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .search-box input {" & vbCrLf & _
    "      width: 100%;" & vbCrLf & _
    "      padding: 10px 15px;" & vbCrLf & _
    "      border-radius: 20px;" & vbCrLf & _
    "      border: 1px solid #333;" & vbCrLf & _
    "      background: #1a1a2e;" & vbCrLf & _
    "      color: #eee;" & vbCrLf & _
    "      font-size: 13px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .chat-list {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      overflow-y: auto;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .chat-item {" & vbCrLf & _
    "      padding: 15px 20px;" & vbCrLf & _
    "      border-bottom: 1px solid #222;" & vbCrLf & _
    "      cursor: pointer;" & vbCrLf & _
    "      transition: background 0.2s;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .chat-item:hover { background: #1a1a2e; }" & vbCrLf & _
    "    .chat-item.active { background: #6366f1/20; border-left: 3px solid #6366f1; }" & vbCrLf & _
    "    .chat-name { font-weight: 600; margin-bottom: 5px; }" & vbCrLf & _
    "    .chat-last-msg { font-size: 12px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" & vbCrLf & _
    "    .main-chat {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      flex-direction: column;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .chat-header {" & vbCrLf & _
    "      padding: 15px 20px;" & vbCrLf & _
    "      border-bottom: 1px solid #333;" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "      font-weight: 600;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .messages {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      overflow-y: auto;" & vbCrLf & _
    "      padding: 20px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .message {" & vbCrLf & _
    "      margin-bottom: 15px;" & vbCrLf & _
    "      max-width: 70%;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .message.sent { margin-left: auto; }" & vbCrLf & _
    "    .message.received { margin-right: auto; }" & vbCrLf & _
    "    .message-bubble {" & vbCrLf & _
    "      padding: 12px 15px;" & vbCrLf & _
    "      border-radius: 15px;" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .message.sent .message-bubble {" & vbCrLf & _
    "      background: linear-gradient(135deg, #6366f1, #8b5cf6);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .message-text { font-size: 14px; line-height: 1.4; }" & vbCrLf & _
    "    .message-time { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 5px; }" & vbCrLf & _
    "    .input-area {" & vbCrLf & _
    "      padding: 15px 20px;" & vbCrLf & _
    "      border-top: 1px solid #333;" & vbCrLf & _
    "      background: #16213e;" & vbCrLf & _
    "      display: flex;" & vbCrLf & _
    "      gap: 10px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .input-area input {" & vbCrLf & _
    "      flex: 1;" & vbCrLf & _
    "      padding: 12px 20px;" & vbCrLf & _
    "      border-radius: 25px;" & vbCrLf & _
    "      border: 1px solid #333;" & vbCrLf & _
    "      background: #1a1a2e;" & vbCrLf & _
    "      color: #eee;" & vbCrLf & _
    "      font-size: 14px;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .input-area button {" & vbCrLf & _
    "      padding: 12px 25px;" & vbCrLf & _
    "      border-radius: 25px;" & vbCrLf & _
    "      border: none;" & vbCrLf & _
    "      background: linear-gradient(135deg, #6366f1, #8b5cf6);" & vbCrLf & _
    "      color: white;" & vbCrLf & _
    "      font-weight: 600;" & vbCrLf & _
    "      cursor: pointer;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    .loading { text-align: center; padding: 40px; color: #888; }" & vbCrLf & _
    "  </style>" & vbCrLf & _
    "</head>" & vbCrLf & _
    "<body>" & vbCrLf & _
    "  <div class='header'>" & vbCrLf & _
    "    <h1>⚡ Nexo Messenger</h1>" & vbCrLf & _
    "    <div class='header-buttons'>" & vbCrLf & _
    "      <button class='btn-refresh' onclick='loadChats()'>🔄 Обновить</button>" & vbCrLf & _
    "      <button class='btn-logout' onclick='logout()'>🚪 Выйти</button>" & vbCrLf & _
    "    </div>" & vbCrLf & _
    "  </div>" & vbCrLf & _
    "  <div class='content'>" & vbCrLf & _
    "    <div class='sidebar'>" & vbCrLf & _
    "      <div class='search-box'>" & vbCrLf & _
    "        <input type='text' placeholder='🔍 Поиск...' id='searchInput' oninput='filterChats()'>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "      <div class='chat-list' id='chatList'>" & vbCrLf & _
    "        <div class='loading'>Загрузка чатов...</div>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "    </div>" & vbCrLf & _
    "    <div class='main-chat'>" & vbCrLf & _
    "      <div class='chat-header' id='chatHeader'>Выберите чат</div>" & vbCrLf & _
    "      <div class='messages' id='messages'>" & vbCrLf & _
    "        <div class='loading' style='margin-top: 100px;'>Выберите чат для просмотра сообщений</div>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "      <div class='input-area'>" & vbCrLf & _
    "        <input type='text' id='messageInput' placeholder='Введите сообщение...' onkeypress='if(event.key===""Enter\"")sendMessage()'>" & vbCrLf & _
    "        <button onclick='sendMessage()'>Отправить</button>" & vbCrLf & _
    "      </div>" & vbCrLf & _
    "    </div>" & vbCrLf & _
    "  </div>" & vbCrLf & _
    "  <script>" & vbCrLf & _
    "    var chats = [];" & vbCrLf & _
    "    var currentChatId = null;" & vbCrLf & _
    "    function loadChats() {" & vbCrLf & _
    "      window.external.loadChats();" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function onChatsLoaded(chatsData) {" & vbCrLf & _
    "      chats = JSON.parse(chatsData);" & vbCrLf & _
    "      var html = '';" & vbCrLf & _
    "      chats.forEach(function(chat) {" & vbCrLf & _
    "        html += '<div class=""chat-item"" onclick=""openChat('''' + chat.id + '''')"" id=""chat-'' + chat.id + ''"">';" & vbCrLf & _
    "        html += '<div class=""chat-name"">'' + chat.name + '</div>';" & vbCrLf & _
    "        html += '<div class=""chat-last-msg"">'' + (chat.lastMessage || 'Нет сообщений') + '</div>';" & vbCrLf & _
    "        html += '</div>';" & vbCrLf & _
    "      });" & vbCrLf & _
    "      document.getElementById('chatList').innerHTML = html;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function openChat(chatId) {" & vbCrLf & _
    "      currentChatId = chatId;" & vbCrLf & _
    "      window.external.loadMessages(chatId);" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function onMessagesLoaded(messagesData) {" & vbCrLf & _
    "      var messages = JSON.parse(messagesData);" & vbCrLf & _
    "      var html = '';" & vbCrLf & _
    "      messages.forEach(function(msg) {" & vbCrLf & _
    "        var cls = msg.isMine ? 'sent' : 'received';" & vbCrLf & _
    "        html += '<div class=""message '' + cls + ''"">';" & vbCrLf & _
    "        html += '<div class=""message-bubble"">';" & vbCrLf & _
    "        html += '<div class=""message-text"">'' + msg.content + '</div>';" & vbCrLf & _
    "        html += '<div class=""message-time"">'' + msg.time + '</div>';" & vbCrLf & _
    "        html += '</div></div>';" & vbCrLf & _
    "      });" & vbCrLf & _
    "      document.getElementById('messages').innerHTML = html;" & vbCrLf & _
    "      document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function sendMessage() {" & vbCrLf & _
    "      var input = document.getElementById('messageInput');" & vbCrLf & _
    "      var text = input.value.trim();" & vbCrLf & _
    "      if (text && currentChatId) {" & vbCrLf & _
    "        window.external.sendMessage(currentChatId, text);" & vbCrLf & _
    "        input.value = '';" & vbCrLf & _
    "      }" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function onMessageSent() {" & vbCrLf & _
    "      if (currentChatId) {" & vbCrLf & _
    "        window.external.loadMessages(currentChatId);" & vbCrLf & _
    "      }" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function logout() {" & vbCrLf & _
    "      window.external.doLogout();" & vbCrLf & _
    "    }" & vbCrLf & _
    "    function filterChats() {" & vbCrLf & _
    "      var query = document.getElementById('searchInput').value.toLowerCase();" & vbCrLf & _
    "      var items = document.querySelectorAll('.chat-item');" & vbCrLf & _
    "      items.forEach(function(item) {" & vbCrLf & _
    "        var text = item.textContent.toLowerCase();" & vbCrLf & _
    "        item.style.display = text.includes(query) ? '' : 'none';" & vbCrLf & _
    "      });" & vbCrLf & _
    "    }" & vbCrLf & _
    "    // Auto-load chats" & vbCrLf & _
    "    setTimeout(loadChats, 500);" & vbCrLf & _
    "  </script>" & vbCrLf & _
    "</body>" & vbCrLf & _
    "</html>"
    
    ' Create IE window for chat
    Dim IE2
    Set IE2 = CreateObject("InternetExplorer.Application")
    IE2.Width = 1100
    IE2.Height = 750
    IE2.Left = 100
    IE2.Top = 50
    IE2.Toolbar = False
    IE2.StatusBar = False
    IE2.Resizable = True
    IE2.Navigate "about:blank"
    IE2.Visible = True
    
    Do While IE2.Busy Or IE2.ReadyState <> 4
        WScript.Sleep 100
    Loop
    
    IE2.Document.Write htmlChat
    IE2.Document.Close
    
    Set IE2.external = New ChatExternal
    IE2.external.SetToken token
    IE2.external.SetUsername username
    IE2.SetWindow IE2
    
    ' Wait for window close
    Do While IE2.Visible
        WScript.Sleep 500
    Loop
End Sub

' ============================================================
' Chat External Class
' ============================================================
Class ChatExternal
    Private authToken
    Private chatUsername
    Private ChatIE
    
    Public Sub SetToken(t)
        authToken = t
    End Sub
    
    Public Sub SetUsername(u)
        chatUsername = u
    End Sub
    
    Public Sub SetWindow(ie)
        Set ChatIE = ie
    End Sub
    
    Public Sub loadChats()
        Dim http, url
        url = ServerURL & "/api/chats"
        
        On Error Resume Next
        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.Open "GET", url, False
        http.SetRequestHeader "Authorization", "Bearer " & authToken
        http.Send
        
        If Err.Number <> 0 Then
            Err.Clear
            Exit Sub
        End If
        On Error GoTo 0
        
        If http.Status = 200 Then
            ChatIE.Document.parentWindow.execScript "onChatsLoaded('" & Replace(http.ResponseText, "'", "\'") & "')"
        End If
    End Sub
    
    Public Sub loadMessages(chatId)
        Dim http, url
        url = ServerURL & "/api/messages/chat/" & chatId
        
        On Error Resume Next
        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.Open "GET", url, False
        http.SetRequestHeader "Authorization", "Bearer " & authToken
        http.Send
        
        If Err.Number <> 0 Then
            Err.Clear
            Exit Sub
        End If
        On Error GoTo 0
        
        If http.Status = 200 Then
            ChatIE.Document.parentWindow.execScript "onMessagesLoaded('" & Replace(http.ResponseText, "'", "\'") & "')"
        End If
    End Sub
    
    Public Sub sendMessage(chatId, text)
        Dim http, url
        url = ServerURL & "/api/messages/send"
        
        On Error Resume Next
        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.Open "POST", url, False
        http.SetRequestHeader "Content-Type", "application/json"
        http.SetRequestHeader "Authorization", "Bearer " & authToken
        http.Send "{""chatId"":""" & chatId & """,""content"":""" & text & """}"
        
        If Err.Number <> 0 Then
            Err.Clear
            MsgBox "Ошибка отправки сообщения", vbCritical
            Exit Sub
        End If
        On Error GoTo 0
        
        If http.Status = 200 Or http.Status = 201 Then
            ChatIE.Document.parentWindow.execScript "onMessageSent()"
        End If
    End Sub
    
    Public Sub doLogout()
        ' Clear saved token
        On Error Resume Next
        WshShell.RegDelete "HKCU\Software\NexoMessenger\Token\"
        WshShell.RegDelete "HKCU\Software\NexoMessenger\User\"
        On Error GoTo 0
        
        ChatIE.Visible = False
        IsLoggedIn = False
    End Sub
End Class

' ============================================================
' Simple JSON Parser (basic)
' ============================================================
Function ParseJSON(jsonStr)
    Dim dict
    Set dict = CreateObject("Scripting.Dictionary")
    
    ' Extract token
    Dim tokenMatch
    tokenMatch = ExtractValue(jsonStr, "token")
    If tokenMatch <> "" Then
        dict.Add "token", tokenMatch
    End If
    
    ' Extract user
    Dim userMatch
    userMatch = ExtractValue(jsonStr, "user")
    If userMatch <> "" Then
        dict.Add "user", userMatch
    End If
    
    ' Extract error
    Dim errorMatch
    errorMatch = ExtractValue(jsonStr, "error")
    If errorMatch <> "" Then
        dict.Add "error", errorMatch
    End If
    
    Set ParseJSON = dict
End Function

Function ExtractValue(jsonStr, key)
    Dim pattern, reg, matches
    pattern = """" & key & """\s*:\s*""([^""]*)"""
    
    Set reg = New RegExp
    reg.Pattern = pattern
    reg.Global = False
    reg.IgnoreCase = True
    
    If reg.Test(jsonStr) Then
        Set matches = reg.Execute(jsonStr)
        ExtractValue = matches(0).SubMatches(0)
    Else
        ExtractValue = ""
    End If
End Function

' Cleanup
Set WshShell = Nothing
Set FSO = Nothing
