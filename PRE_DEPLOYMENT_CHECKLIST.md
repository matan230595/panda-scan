# רשימת בדיקת מוכנות לקראת פריסה (Pre-Deployment Checklist) - scan.panda-il.com

השלם את הצעדים הבאים כדי להבטיח עליית גרסה חלקה, מאובטחת ומהירה בכתובת המיועדת.

---

## 🔑 1. הגדרות משתני סביבה בשרת (Environment Variables)
יש לשמור את המפתחות הבאים בקובץ `.env` בשרת ה-VPS או להזין אותם כ-Environment Variables במערכת ה-Docker שלך:

| שם המשתנה | תיאור | מקור המפתח ב-Firebase |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | מפתח ה-API הציבורי של הקליינט | Project Settings -> General -> Web Apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | כתובת הדומיין של ה-Auth בפרויקט | Project Settings -> General -> Web Apps |
| `VITE_FIREBASE_PROJECT_ID` | מזהה ייחודי של פרויקט ה-Firebase | Project Settings -> General -> Web Apps |
| `VITE_FIREBASE_STORAGE_BUCKET` | דלי האחסון של הפרויקט לשמירת לוגו קבצים | Project Settings -> General -> Web Apps |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | מזהה שולח הודעות לדיאגנוסטיקה מקוונת | Project Settings -> General -> Web Apps |
| `VITE_FIREBASE_APP_ID` | מזהה האפליקציה ב-Firebase | Project Settings -> General -> Web Apps |

---

## 🔥 2. שלבי קונפיגורציה בפיירבייס (Firebase Console)
אם אינך מוצא את הפרויקט בפאנל, ודא שאתה מחובר ל-[Firebase Console](https://console.firebase.google.com/) עם **אותה כתובת המייל** שבה פתחת או קשרת את האפליקציה (`matan230595@gmail.com`). 

### א. הוספת הדומיין המורשה (Authorized Domain):
כאשר משתמש מנסה להתחבר באמצעות Google Sign-In, פיירבייס חוסם חיבורים מדומיינים שאינם מאושרים.
1. היכנס לתפריט **Authentication** -> לשונית **Settings** -> תפריט **Authorized domains**.
2. הוסף את הכתובות הבאות:
   * `scan.panda-il.com`
   * `panda-il.com`

### ב. חוקי אבטחה ב-Firestore (Firestore Rules):
ודא כי חוקי הגישה מאפשרים קריאה וכתיבה רק למשתמשים מורשים המחוברים למערכת:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🐳 3. בדיקות מקדימות ב-Docker (Docker Integrity Checks)
לפני עלייה לפרודקשיין, מומלץ להריץ בדיקה מקומית במחשב שלך:
1. **הרצה מקומית בנמל 80:** 
   ```bash
   docker build -t scan-panda-app .
   docker run -d -p 8080:80 scan-panda-app
   ```
2. פתח את הדפדפן בכתובת `http://localhost:8080` וודא שהטעינה והניתובים עובדים בצורה חלקה.

---

## 🔒 4. תעודת אבטחה SSL
חל איסור להשתמש בחיבור שאינו מוצפן (HTTP) עבור אפליקציות סריקת ברקודים ואזורי מנהלים. ודא כי שירות Certificate מוגדר ועובד בשרת או דרך Cloudflare / Certbot כדי שכל הקישורים יופנו ל-HTTPS.
