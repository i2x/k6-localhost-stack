# k6 + InfluxDB + Telegraf + Grafana (Local)

สแต็กทดสอบโหลด + มอนิเตอร์เครื่อง (CPU/RAM/ฯลฯ)

---

## 0) พอร์ต & ข้อกำหนด
```
Grafana: 3000
InfluxDB: 8086
Backend (ตัวอย่าง Django): 8000
```

---

## 1) โครงสร้างโปรเจ็กต์
```text
.
├── docker-compose.yml
├── grafana/
│   └── provisioning/
│       ├── datasources/datasource.yml
│       └── dashboards/k6-localhost.json
├── k6/
│   ├── .env.k6
│   ├── load.js
│   └── sample.jpg
└── telegraf/telegraf.conf
```

---

## 2) ตั้งค่า k6 (เป้าหมายยิง)
```env
# k6/.env.k6
# macOS/Windows (Docker Desktop)
BASE_URL=http://host.docker.internal:8000
PREDICT_ENDPOINT=/api/predict/

# Linux (ตัวอย่าง)
# BASE_URL=http://localhost:8000
# PREDICT_ENDPOINT=/api/predict/
```

> ตรวจ trailing slash ของ endpoint ให้ตรงกับฝั่ง backend

---

## 3) สตาร์ทสแต็ก
```bash
docker compose up -d --build
```

---

## 4) เปิด Grafana
```text
URL: http://localhost:3000
Login: admin / admin
Dashboard: Load Testing → k6 + Host (CPU/RAM) - Local
```

---

## 5) รันทดสอบโหลด
```bash
# ใช้ค่าใน k6/.env.k6
docker compose run --rm k6
```

```bash
# Override ชั่วคราว
docker compose run --rm   -e BASE_URL=http://host.docker.internal:8000   -e PREDICT_ENDPOINT=/api/predict/   k6
```

> เปิดดู RPS, p95 latency, error rate, CPU total (%), Memory used (%) บน Grafana ระหว่างรัน

---

## 6) ตรวจ InfluxDB มีข้อมูลเข้าไหม
```bash
# รายการ measurement
docker compose exec influxdb   influx -database 'k6' -execute 'SHOW MEASUREMENTS'
```

```bash
# field key สำคัญ
docker compose exec influxdb   influx -database 'k6' -execute 'SHOW FIELD KEYS FROM http_req_duration'
docker compose exec influxdb   influx -database 'k6' -execute 'SHOW FIELD KEYS FROM cpu'
docker compose exec influxdb   influx -database 'k6' -execute 'SHOW FIELD KEYS FROM mem'
```

```bash
# tag name (กรอง per-endpoint)
docker compose exec influxdb   influx -database 'k6' -execute   "SHOW TAG VALUES FROM http_reqs WITH KEY = name"
```

---

## 7) เคลียร์ / รีเซ็ต
```bash
# หยุดคอนเทนเนอร์
docker compose down
```

```bash
# ล้างทุกอย่าง (รวม volumes)
docker compose down -v
```

```bash
# ล้าง image ที่ไม่ใช้ (ออปชัน)
docker image prune -f
```

```bash
# ล้าง network ที่ไม่ใช้ (ออปชัน)
docker network prune -f
```

```bash
# รีเซ็ตเฉพาะ DB 'k6' (ต้องมีคอนเทนเนอร์ influxdb กำลังรัน)
docker compose exec influxdb influx -execute 'DROP DATABASE k6'
docker compose exec influxdb influx -execute 'CREATE DATABASE k6'
```

---

## 8) ปรับโหลด (k6)
```js
// k6/load.js : เบสิค
export const options = { vus: 10, duration: '2m' };
```

```js
// k6/load.js : scenarios (ควบคุมรูปทรงโหลด)
export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'] },
};
```

---

## 9) มอนิเตอร์ (Telegraf)
```toml
# telegraf/telegraf.conf (สรุป)
# interval = "1s"
# [[inputs.cpu]] [[inputs.mem]] [[inputs.disk]] [[inputs.net]] [[inputs.system]] [[inputs.docker]]
# [[outputs.influxdb]] database = "k6"
```

```toml
# เก็บเฉพาะโปรเซส (ออปชัน)
# [[inputs.procstat]]
#   pattern = "gunicorn|python manage.py|uvicorn"
#   pid_finder = "native"
```
