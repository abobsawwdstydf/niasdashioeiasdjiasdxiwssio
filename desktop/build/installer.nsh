; Nexo Messenger Custom Installer Script
; Dark theme styled installer

!macro customInit
  ; Set custom installer title
  StrCpy $INSTDIR "$PROGRAMFILES64\Nexo Messenger"
!macroend

!macro customWelcomePage
  ; Custom welcome page with dark theme
  !insertmacro MUI_HEADER_TEXT "Nexo Messenger" "Welcome to the Setup Wizard"
  
  ; Create welcome label
  nsDialogs::Create 1018
  Pop $0
  
  ${NSD_CreateLabel} 0 0 100% 100% "Welcome to Nexo Messenger Setup$\r$\n$\r$\nThis will install Nexo Messenger on your computer.$\r$\n$\r$\nClick Next to continue."
  Pop $0
  
  nsDialogs::Show
!macroend

!macro customInstallDirPage
  ; Custom installation directory page
  !insertmacro MUI_HEADER_TEXT "Nexo Messenger" "Choose Install Location"
  
  nsDialogs::Create 1018
  Pop $0
  
  ; Dark background
  SetCtlColors $0 0xFFFFFF 0x09090b
  
  ; Label
  ${NSD_CreateLabel} 0 0 100% 20u "Choose where to install Nexo Messenger:"
  Pop $0
  SetCtlColors $0 0xFFFFFF 0x09090b
  
  ; Directory text box
  ${NSD_CreateText} 0 25u 100% 20u "$INSTDIR"
  Pop $DIR_TEXT
  SetCtlColors $DIR_TEXT 0xFFFFFF 0x1a1a1e
  
  ; Browse button
  ${NSD_CreateButton} 80% 25u 20% 20u "Browse..."
  Pop $BROWSE_BTN
  ${NSD_OnClick} $BROWSE_BTN BrowseDirectory
  
  nsDialogs::Show
!macroend

!macro customBrowseDirectory
  nsDialogs::SelectFolderDialog "Select Installation Folder" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    StrCpy $INSTDIR $0
    ${NSD_SetText} $DIR_TEXT $INSTDIR
  ${EndIf}
!macroend

!macro customInstall
  ; Custom install actions
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
  
  ; Create start menu shortcut
  CreateShortCut "$SMPROGRAMS\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
!macroend

!macro customUnInstall
  ; Custom uninstall actions
  ; Remove desktop shortcut
  Delete "$DESKTOP\Nexo Messenger.lnk"
  
  ; Remove start menu shortcut
  Delete "$SMPROGRAMS\Nexo Messenger.lnk"
  
  ; Remove installation directory
  RMDir /r "$INSTDIR"
!macroend
