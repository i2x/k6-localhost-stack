import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

// ===== Config =====
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const ENDPOINTS = { predict: __ENV.PREDICT_ENDPOINT || "/api/predict/" };

// ===== Custom metrics & thresholds =====
export const tPredict = new Trend("rt_post_predict");
export const httpErr  = new Counter("http_errors");

export const options = {
  vus: 20,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    rt_post_predict: ["p(95)<1200"],
  },
  tags: { env: "local", target: "django" },
};


const sampleBytes = open("./sample.jpg", "b"); // preload once; shared read-only across VUs

function isAcceptable(r) {
  return r.status === 200;
}

export default function () {
  const form = {
    image: http.file(sampleBytes, "sample.jpg", "image/jpeg"),
  };

  const res = http.post(`${BASE_URL}${ENDPOINTS.predict}`, form, {
    tags: { name: "POST /api/predict" },
  });

  tPredict.add(res.timings.duration);

  const ok = check(res, {
    "predict acceptable": r => isAcceptable(r),
    "body exists": r => !!r.body,
  });

  if (!ok) {
    httpErr.add(1);
    if (Math.random() < 0.05) {
      console.error(`POST /api/predict status=${res.status} body=${String(res.body).slice(0,200)}`);
    }
  }

  sleep(Math.random() * 0.5);
}
