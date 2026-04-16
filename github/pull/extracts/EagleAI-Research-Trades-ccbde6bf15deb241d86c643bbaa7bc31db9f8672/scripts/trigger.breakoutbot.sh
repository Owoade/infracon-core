while true; do
  gcloud pubsub topics publish breakout.executions.v1 --project=eagleailabs-analytics --message='{
  "user_id": "<float or string>",
  "execution_id": "<uuid4>",
  "timestamp": "<ISO8601 UTC>",
  "symbol": "BTC-USDT",
  "exchange": "APEX",
  "side": "BUY",
  "type": "MARKET",
  "qty": "<float or string>",
  "price": "<float or string | null>",
  "order_id": "<exchange order id>",
  "status": "SUCCESS",
  "reason": "<error message if failed>",
  "source_decision": {
    "decision_id": "<uuid>",
    "signal_id": "<uuid>",
    "signal_timestamp": "<ISO8601>",
    "decision_timestamp": "<ISO8601>",
    "model_name": "BreakoutBot_vX",
    "direction": "LONG",
    "confidence": "<float 0-1>",
    "timeframe": "<string e.g 1h>"
  }
}
'
  sleep 600
done