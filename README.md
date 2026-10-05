# Exam Proctor

## Run
1. Node.js install korun (v18+)
2. VS Code terminal e:  `npm install` then `npm start`
3. Student: http://localhost:3000
4. Admin:   http://localhost:3000/admin.html  (default pass: `admin123`)
   Pass change: `ADMIN_PASS=mypass npm start` (Windows PowerShell: `$env:ADMIN_PASS="mypass"; npm start`)

## Features
- Webcam live + periodic snapshots (every 20s), saved in `data/snaps`
- Face detection: no face / multiple faces (Chrome/Edge FaceDetector API)
- Tab switch, window blur, fullscreen exit, copy/paste/cut, right-click, DevTools shortcuts detection
- Violation limit -> auto-submit; countdown timer auto-submit
- Admin dashboard: score, violation log, snapshots

## Customize
`questions.json` e questions, duration, maxViolations edit korun.

## Note
Browser-based proctoring 100% cheat-proof na; serious exam e HTTPS (camera er jonno) + server-side checks add korben.
