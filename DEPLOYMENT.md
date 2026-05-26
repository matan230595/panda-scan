# מדריך פריסה ואירוח עצמי (Self-Hosting Deployment) - ScanPanda OS

מדריך ידידותי ומפורט צעד-אחר-צעד, המיועד גם למי שאין לו ניסיון קודם בפיתוח שרתים או תקשורת. במדריך זה נלמד כיצד לעבוד עם **Git** (כדי להעלות ולעדכן קוד בקלות) ועם **Docker** (כדי להריץ את האפליקציה בתוך קונטיינר מבודד ומאובטח) על שרת ה-**VPS** האישי שלך עבור תת-הדומיין: `scan.panda-il.com`.

---

## 🧭 סקירה כללית של תהליך העבודה (הכי קל, מחובר ל-Git)
במקום לעשות "העתק-הדבק" ידני של קבצים לשרת בכל פעם שהקוד משתנה, אנחנו נעבוד בשיטה המקצועית והנוחה ביותר:
1. **במחשב האישי שלך:** מעלים את קוד הפרויקט ל-**GitHub** (או כל שרת Git אחר).
2. **בשרת ה-VPS:** "מושכים" (Pull) את הקוד מ-GitHub ומריצים אותו באמצעות **Docker** בפקודה אחת פשוטה.
3. **לעדכון בעתיד:** עושים Push מהמחשב ו-Pull בשרת. זה הכל!

---

## 📋 שלב 1: אישור הדומיין ב-Firebase (קריטי לפני הכל!)
כדי שאימות המשתמשים (כמו כניסה עם Google) יעבוד בכתובת החדשה, פיירבייס חייב להכיר את הדומיין שלך:
1. היכנס ל-[Firebase Console](https://console.firebase.google.com/).
2. ודא שאתה מחובר עם המייל של הפרויקט (`matan230595@gmail.com`).
3. בחר בפרויקט שלך ברשימה.
4. בתפריט הצד, לחץ על **Build** ⬅️ **Authentication**.
5. עבור ללשונית **Settings** (הגדרות) למעלה.
6. בתפריט הצדדי של הדף, לחץ על **Authorized domains** (דומיינים מורשים).
7. לחץ על **Add domain** (הוסף דומיין) והזן את הדומיין שלך:
   ```text
   scan.panda-il.com
   ```
8. לחץ על **Save** (שמירה).

---

## 💻 שלב 2: העלאת הפרויקט ל-GitHub (במחשב האישי שלך)
כדי לקשר את הפרויקט לשרת, נעלה אותו ל-GitHub בפעם הראשונה:

1. היכנס ל-[GitHub](https://github.com/) ופתח חשבון חינמי (אם עדיין אין לך).
2. פתח מאגר קוד חדש (Repository) וקרא לו למשל `scan-panda`. בחר אותו כ-**Private** (פרטי) כדי לשמור על קובצי הפרויקט שלך חסויים.
3. במחשב האישי שלך, בתוך תיקיית הפרויקט, פתח את הטרמינל (או PowerShell ב-Windows) והרץ את הפקודות הבאות לחיבור והעלאת הקוד:
   ```bash
   # הגדרת תיקיית Git מקומית
   git init
   git add .
   git commit -m "initial commit for ScanPanda"
   
   # קישור למאגר הקוד ב-GitHub (החלף בקישור האמיתי שקיבלת מ-GitHub)
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/scan-panda.git
   
   # העלאת הקוד לענן
   git push -u origin main
   ```

---

## 🖥️ שלב 3: התחברות לשרת ה-VPS והתקנת Docker
כעת נעבור לשרת ה-VPS שלך.

1. **איך מתחברים?** פתח את הטרמינל במחשב שלך (או PowerShell או תוכנת Putty ב-Windows) והקלד את הפקודה להתחברות (החלף את ה-IP בכתובת של השרת שלך):
   ```bash
   ssh root@YOUR_SERVER_IP
   ```
   *השרת יבקש את הסיסמה שקיבלת מספק ה-VPS שלך. הקלד אותה ולחץ Enter (שים לב שלא רואים תווים נכתבים משום סיבות אבטחה, זה תקין).*

2. **עדכון השרת הקיים:** נרענן את השרת כדי לוודא שכל חבילות המערכת מעודכנות:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **התקנת Git בשרת (אם עדיין לא מותקן):**
   ```bash
   sudo apt install git -y
   ```

4. **התקנת Docker & Docker Compose בשרת:**
   נריץ פקודה רשמית ומהירה להתקנת Docker בשרת ה-VPS:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

5. ודא ש-Docker הותקן בהצלחה ועובד:
   ```bash
   sudo systemctl status docker
   ```
   *(לחיצה על המקש `q` במקלדת תוציא אותך ממסך הסטטוס).*

---

## 📂 שלב 4: משיכת הקוד לשרת והגדרת משתני הסביבה (Firebase)

1. צור תיקייה ייעודית עבור האפליקציה בשרת וכנס אליה:
   ```bash
   mkdir -p /var/www
   cd /var/www
   ```

2. משוך (Clone) את פרויקט ה-Git שלך מ-GitHub (בפעם הראשונה השרת יבקש ממך את פרטי ההתחברות שלך או Token מ-GitHub):
   ```bash
   git clone https://github.com/YOUR_USERNAME/scan-panda.git
   cd scan-panda
   ```

3. **יצירת קובץ הגדרות ה-Firebase (משתני סביבה):**
   בתוך תיקיית הפרויקט המקומית בשרת, ניצור את הקובץ שמחבר את האפליקציה לפיירבייס שלך.
   נפתח עורך טקסט פשוט בשם `nano`:
   ```bash
   nano .env
   ```
   כעת, העתק והדבק את הקוד הבא אל תוך הקובץ, ושנה את הערכים למפתחות האמיתיים של ה-Firebase שלך (תוכל למצוא אותם ב-Firebase Console תחת Project Settings ⬅️ Web Apps):
   ```env
   VITE_FIREBASE_API_KEY=your_real_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=scan-panda-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=scan-panda-xxxx
   VITE_FIREBASE_STORAGE_BUCKET=scan-panda-xxxx.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
   *לשמירת הקובץ ב-nano: לחץ על `Ctrl + O` ואז `Enter`. ליציאה חזרה לטרמינל לחץ על `Ctrl + X`.*

---

## 🐳 שלב 5: בנייה והרצת האפליקציה בתוך Docker
הכנו עבורך קובץ `Dockerfile` ו-`nginx.conf` מובנים ומושלמים בתוך הפרויקט. כל שעליך לעשות כעת הוא לבנות ולהריץ את הקונטיינר!

1. **בניית ה-Docker Image (בפעם הראשונה זה עשוי לקחת 1-2 דקות):**
   ```bash
   docker build -t scan-panda-app .
   ```

2. **הרצת הקונטיינר בשרת:**
   אנחנו נפעיל את האפליקציה ברקע (הדגל `-d`) ונמפה אותה לפורט פנימי קל, למשל `8080`, כדי ששרת ה-Proxy של ה-VPS יוכל להעביר אליה תנועה:
   ```bash
   docker run -d --name scan-panda-container --restart always -p 8080:80 scan-panda-app
   ```

3. ודא שהקונטיינר עובד בהצלחה:
   ```bash
   docker ps
   ```
   *(אתה אמור לראות את container בשם `scan-panda-container` ברשימה תחת סטאטוס Up).*

---

## 🌐 שלב 6: הגדרת תת-הדומיין `scan.panda-il.com` וחיבור SSL (אבטחה מקסימלית)
כדי לאפשר כניסה לכתובת הישירה שלכם בצורה מאובטחת, נשתמש ב-Nginx המקומי בשרת כ-Reverse Proxy שיפנה את הגולשים לתוך ה-Docker.

1. **התקנת שרת Nginx הראשי בשרת ה-VPS:**
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx -y
   ```

2. **יצירת קובץ קונפיגורציה עבור תת-הדומיין שלכם:**
   ```bash
   sudo nano /etc/nginx/sites-available/scan-panda
   ```

3. **הדבק את ההגדרות הבאות בפנים:**
   ```nginx
   server {
       listen 80;
       server_name scan.panda-il.com;

       location / {
           # מעביר את התנועה באופן ישיר לקונטיינר ה-Docker שרץ בפורט 8080
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   *שמור וצא (`Ctrl+O` ⬅️ `Enter` ⬅️ `Ctrl+X`).*

4. **הפעלת האתר ב-Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/scan-panda /etc/nginx/sites-enabled/
   ```

5. **בדיקה שההגדרות תקינות:**
   ```bash
   sudo nginx -t
   ```
   *(אם קיבלת הודעה שהכל test is successful, רענן את השירות):*
   ```bash
   sudo systemctl restart nginx
   ```

6. **הנפקת תעודת אבטחה SSL (HTTPS) חינמית ומאובטחת בשניות:**
   ```bash
   sudo certbot --nginx -d scan.panda-il.com
   ```
   *במהלך ההפעלה, Certbot ישאל אותך לגבי קבלת מיילים ואישור תקנון. בנוסף, הוא ישאל האם להפנות אוטומטית את כל הגולשים מ-HTTP ל-HTTPS. בחר תמיד באופציה של הפניה אוטומטית (Redirect).*

---

## 🎉 זהו זה! האפליקציה שלכם באוויר!
כעת פתח את הדפדפן שלך וכנס לכתובת הבאה:
`https://scan.panda-il.com`

ותראה את מערכת **ScanPanda OS** החדשה והחדישה עובדת בצורה יציבה, חלקה לחלוטין, מהירה כבזק ומאובטחת ב-HTTPS!

---

## 🔄 איך מעדכנים קוד בעתיד בקלות? (תוך 10 שניות!)
בכל פעם שתעשה שינויים בקוד ותרצה לעדכן את השרת הקיים:

1. **במחשב האישי שלך:**
   ```bash
   git add .
   git commit -m "update cool feature"
   git push origin main
   ```

2. **בשרת ה-VPS שלך (התחבר דרך SSH והקלד):**
   ```bash
   cd /var/www/scan-panda
   git pull origin main
   
   # בנייה מחדש של ה-Docker
   docker build -t scan-panda-app .
   
   # עצירה והרצה מחדש של הקונטיינר הקיים
   docker stop scan-panda-container
   docker rm scan-panda-container
   docker run -d --name scan-panda-container --restart always -p 8080:80 scan-panda-app
   ```
   המערכת תתעדכן מיד ללא שום צורך לגעת בהגדרות ה-Nginx או ה-SSL מחדש!
