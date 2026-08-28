#property copyright "EdgeVault"
#property version   "3.01"
#property strict

input string EdgeVaultJobId = "";
input string EdgeVaultAccountId = "";
input string EdgeVaultWorkerId = "london-mt5-01";
input string EdgeVaultExpectedLogin = "";
input string EdgeVaultTerminalSlot = "Slot01";
input string EdgeVaultResultFile = "edgevault_bridge_result.json";
input string EdgeVaultSyncFile = "edgevault_mt5_sync.json";
input int EdgeVaultConnectTimeoutSeconds = 150;
input int EdgeVaultSnapshotSeconds = 5;
input int EdgeVaultHistoryBatchSize = 200;
input int EdgeVaultIncrementalSyncSeconds = 10;
input int EdgeVaultHistoryOverlapSeconds = 300;
input int EdgeVaultAccountSnapshotSeconds = 60;

datetime started_at = 0;
datetime last_snapshot_at = 0;
datetime last_sync_cycle_at = 0;
datetime sync_cycle_end = 0;
datetime previous_sync_cycle_end = 0;
datetime last_account_snapshot_at = 0;
bool failure_written = false;
bool history_cycle_active = false;
bool initial_history_complete = false;
bool immediate_sync_requested = true;
int history_deal_index = 0;
int history_order_index = 0;
int history_deal_total = 0;
int history_order_total = 0;
long history_start_time_msc = 0;
long last_deal_time_msc = 0;
ulong last_deal_ticket = 0;
long last_order_time_msc = 0;

string JsonEscape(string value)
  {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   StringReplace(value,"\t","\\t");
   return value;
  }

string JsonString(string value) { return "\""+JsonEscape(value)+"\""; }
string JsonBool(bool value) { return value ? "true" : "false"; }
string JsonNumber(double value,int digits=8) { return DoubleToString(value,digits); }
string JsonLong(long value) { return JsonString(IntegerToString(value)); }
string JsonUlong(ulong value) { return JsonString(IntegerToString((long)value)); }

int BrokerUtcOffsetMinutes()
  {
   datetime broker_now=TimeTradeServer();
   if(broker_now<=0) broker_now=TimeCurrent();
   double raw_offset_minutes=(double)(broker_now-TimeGMT())/60.0;
   return (int)(MathRound(raw_offset_minutes/15.0)*15.0);
  }

string DateTimeToIso(datetime value)
  {
   string text=TimeToString(value,TIME_DATE|TIME_SECONDS);
   StringReplace(text,".","-");
   StringReplace(text," ","T");
   return text+"Z";
  }

string BrokerMscToUtcIso(long broker_time_msc,int offset_minutes)
  {
   long utc_time_msc=broker_time_msc-(long)offset_minutes*60000;
   datetime utc_seconds=(datetime)(utc_time_msc/1000);
   int milliseconds=(int)(utc_time_msc%1000);
   if(milliseconds<0) milliseconds=-milliseconds;
   string text=TimeToString(utc_seconds,TIME_DATE|TIME_SECONDS);
   StringReplace(text,".","-");
   StringReplace(text," ","T");
   return text+StringFormat(".%03dZ",milliseconds);
  }

string BrokerMscToText(long broker_time_msc)
  {
   return TimeToString((datetime)(broker_time_msc/1000),TIME_DATE|TIME_SECONDS);
  }

string EnumName(string value)
  {
   StringToLower(value);
   return value;
  }

string DealTypeName(long value) { return EnumName(EnumToString((ENUM_DEAL_TYPE)value)); }
string DealEntryName(long value) { return EnumName(EnumToString((ENUM_DEAL_ENTRY)value)); }
string DealReasonName(long value) { return EnumName(EnumToString((ENUM_DEAL_REASON)value)); }
string OrderTypeName(long value) { return EnumName(EnumToString((ENUM_ORDER_TYPE)value)); }
string OrderStateName(long value) { return EnumName(EnumToString((ENUM_ORDER_STATE)value)); }
string OrderReasonName(long value) { return EnumName(EnumToString((ENUM_ORDER_REASON)value)); }
string PositionReasonName(long value) { return EnumName(EnumToString((ENUM_POSITION_REASON)value)); }

string BuildLegacyPositionsJson()
  {
   string json="[";
   int total=PositionsTotal();
   for(int index=0; index<total; index++)
     {
      ulong ticket=PositionGetTicket(index);
      if(ticket==0) continue;
      if(StringLen(json)>1) json+=",";
      long position_type=PositionGetInteger(POSITION_TYPE);
      json+="{";
      json+="\"ticket\":"+IntegerToString((long)ticket)+",";
      json+="\"identifier\":"+IntegerToString(PositionGetInteger(POSITION_IDENTIFIER))+",";
      json+="\"symbol\":"+JsonString(PositionGetString(POSITION_SYMBOL))+",";
      json+="\"side\":"+JsonString(position_type==POSITION_TYPE_BUY ? "buy" : "sell")+",";
      json+="\"volume\":"+JsonNumber(PositionGetDouble(POSITION_VOLUME),8)+",";
      json+="\"priceOpen\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_OPEN),10)+",";
      json+="\"priceCurrent\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT),10)+",";
      json+="\"stopLoss\":"+JsonNumber(PositionGetDouble(POSITION_SL),10)+",";
      json+="\"takeProfit\":"+JsonNumber(PositionGetDouble(POSITION_TP),10)+",";
      json+="\"profit\":"+JsonNumber(PositionGetDouble(POSITION_PROFIT),8)+",";
      json+="\"swap\":"+JsonNumber(PositionGetDouble(POSITION_SWAP),8)+",";
      json+="\"openedAt\":"+IntegerToString(PositionGetInteger(POSITION_TIME))+",";
      json+="\"comment\":"+JsonString(PositionGetString(POSITION_COMMENT));
      json+="}";
     }
   return json+"]";
  }

string BuildSyncPositionsJson(bool &positions_complete)
  {
   string json="[";
   int total=PositionsTotal();
   int limit=MathMin(total,500);
   positions_complete=(total<=500);
   int offset_minutes=BrokerUtcOffsetMinutes();
   for(int index=0; index<limit; index++)
     {
      ulong ticket=PositionGetTicket(index);
      if(ticket==0) continue;
      if(StringLen(json)>1) json+=",";
      long position_type=PositionGetInteger(POSITION_TYPE);
      long opened_time_msc=PositionGetInteger(POSITION_TIME_MSC);
      long updated_time_msc=PositionGetInteger(POSITION_TIME_UPDATE_MSC);
      long reason=PositionGetInteger(POSITION_REASON);
      json+="{";
      json+="\"positionIdentifier\":"+JsonLong(PositionGetInteger(POSITION_IDENTIFIER))+",";
      json+="\"positionTicket\":"+JsonUlong(ticket)+",";
      json+="\"magicNumber\":"+JsonLong(PositionGetInteger(POSITION_MAGIC))+",";
      json+="\"symbol\":"+JsonString(PositionGetString(POSITION_SYMBOL))+",";
      json+="\"positionTypeCode\":"+IntegerToString(position_type)+",";
      json+="\"direction\":"+JsonString(position_type==POSITION_TYPE_BUY ? "buy" : "sell")+",";
      json+="\"reasonCode\":"+IntegerToString(reason)+",";
      json+="\"reason\":"+JsonString(PositionReasonName(reason))+",";
      json+="\"openedTimeMsc\":"+JsonLong(opened_time_msc)+",";
      json+="\"updatedTimeMsc\":"+JsonLong(updated_time_msc)+",";
      json+="\"openedAtUtc\":"+JsonString(BrokerMscToUtcIso(opened_time_msc,offset_minutes))+",";
      json+="\"updatedAtUtc\":"+JsonString(BrokerMscToUtcIso(updated_time_msc,offset_minutes))+",";
      json+="\"openedBrokerTimeText\":"+JsonString(BrokerMscToText(opened_time_msc))+",";
      json+="\"updatedBrokerTimeText\":"+JsonString(BrokerMscToText(updated_time_msc))+",";
      json+="\"brokerUtcOffsetMinutes\":"+IntegerToString(offset_minutes)+",";
      json+="\"volume\":"+JsonNumber(PositionGetDouble(POSITION_VOLUME),8)+",";
      json+="\"priceOpen\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_OPEN),10)+",";
      json+="\"priceCurrent\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT),10)+",";
      json+="\"stopLoss\":"+JsonNumber(PositionGetDouble(POSITION_SL),10)+",";
      json+="\"takeProfit\":"+JsonNumber(PositionGetDouble(POSITION_TP),10)+",";
      json+="\"swap\":"+JsonNumber(PositionGetDouble(POSITION_SWAP),8)+",";
      json+="\"profit\":"+JsonNumber(PositionGetDouble(POSITION_PROFIT),8)+",";
      json+="\"comment\":"+JsonString(PositionGetString(POSITION_COMMENT))+",";
      json+="\"externalId\":"+JsonString(PositionGetString(POSITION_EXTERNAL_ID))+",";
      json+="\"isOpen\":true";
      json+="}";
     }
   return json+"]";
  }

string BuildDealJson(ulong ticket,int offset_minutes)
  {
   long time_msc=HistoryDealGetInteger(ticket,DEAL_TIME_MSC);
   long deal_type=HistoryDealGetInteger(ticket,DEAL_TYPE);
   long entry_type=HistoryDealGetInteger(ticket,DEAL_ENTRY);
   long reason=HistoryDealGetInteger(ticket,DEAL_REASON);
   if(time_msc>last_deal_time_msc || (time_msc==last_deal_time_msc && ticket>last_deal_ticket))
     {
      last_deal_time_msc=time_msc;
      last_deal_ticket=ticket;
     }
   string json="{";
   json+="\"dealTicket\":"+JsonUlong(ticket)+",";
   json+="\"orderTicket\":"+JsonLong(HistoryDealGetInteger(ticket,DEAL_ORDER))+",";
   json+="\"positionIdentifier\":"+JsonLong(HistoryDealGetInteger(ticket,DEAL_POSITION_ID))+",";
   json+="\"timeMsc\":"+JsonLong(time_msc)+",";
   json+="\"executedAtUtc\":"+JsonString(BrokerMscToUtcIso(time_msc,offset_minutes))+",";
   json+="\"brokerTimeText\":"+JsonString(BrokerMscToText(time_msc))+",";
   json+="\"brokerUtcOffsetMinutes\":"+IntegerToString(offset_minutes)+",";
   json+="\"dealTypeCode\":"+IntegerToString(deal_type)+",";
   json+="\"dealType\":"+JsonString(DealTypeName(deal_type))+",";
   json+="\"entryTypeCode\":"+IntegerToString(entry_type)+",";
   json+="\"entryType\":"+JsonString(DealEntryName(entry_type))+",";
   json+="\"reasonCode\":"+IntegerToString(reason)+",";
   json+="\"reason\":"+JsonString(DealReasonName(reason))+",";
   json+="\"magicNumber\":"+JsonLong(HistoryDealGetInteger(ticket,DEAL_MAGIC))+",";
   json+="\"symbol\":"+JsonString(HistoryDealGetString(ticket,DEAL_SYMBOL))+",";
   json+="\"volume\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_VOLUME),8)+",";
   json+="\"price\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_PRICE),10)+",";
   json+="\"commission\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_COMMISSION),8)+",";
   json+="\"swap\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_SWAP),8)+",";
   json+="\"profit\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_PROFIT),8)+",";
   json+="\"fee\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_FEE),8)+",";
   json+="\"stopLoss\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_SL),10)+",";
   json+="\"takeProfit\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_TP),10)+",";
   json+="\"accountCurrency\":"+JsonString(AccountInfoString(ACCOUNT_CURRENCY))+",";
   json+="\"comment\":"+JsonString(HistoryDealGetString(ticket,DEAL_COMMENT))+",";
   json+="\"externalId\":"+JsonString(HistoryDealGetString(ticket,DEAL_EXTERNAL_ID));
   json+="}";
   return json;
  }

string BuildHistoryOrderJson(ulong ticket,int offset_minutes)
  {
   long setup_time_msc=HistoryOrderGetInteger(ticket,ORDER_TIME_SETUP_MSC);
   long done_time_msc=HistoryOrderGetInteger(ticket,ORDER_TIME_DONE_MSC);
   long expiration_time_msc=HistoryOrderGetInteger(ticket,ORDER_TIME_EXPIRATION)*1000;
   long order_type=HistoryOrderGetInteger(ticket,ORDER_TYPE);
   long order_state=HistoryOrderGetInteger(ticket,ORDER_STATE);
   long reason=HistoryOrderGetInteger(ticket,ORDER_REASON);
   last_order_time_msc=MathMax(last_order_time_msc,done_time_msc>0 ? done_time_msc : setup_time_msc);
   string json="{";
   json+="\"orderTicket\":"+JsonUlong(ticket)+",";
   json+="\"positionIdentifier\":"+JsonLong(HistoryOrderGetInteger(ticket,ORDER_POSITION_ID))+",";
   json+="\"positionByIdentifier\":"+JsonLong(HistoryOrderGetInteger(ticket,ORDER_POSITION_BY_ID))+",";
   json+="\"magicNumber\":"+JsonLong(HistoryOrderGetInteger(ticket,ORDER_MAGIC))+",";
   json+="\"symbol\":"+JsonString(HistoryOrderGetString(ticket,ORDER_SYMBOL))+",";
   json+="\"orderTypeCode\":"+IntegerToString(order_type)+",";
   json+="\"orderType\":"+JsonString(OrderTypeName(order_type))+",";
   json+="\"orderStateCode\":"+IntegerToString(order_state)+",";
   json+="\"orderState\":"+JsonString(OrderStateName(order_state))+",";
   json+="\"reasonCode\":"+IntegerToString(reason)+",";
   json+="\"reason\":"+JsonString(OrderReasonName(reason))+",";
   json+="\"fillingTypeCode\":"+IntegerToString(HistoryOrderGetInteger(ticket,ORDER_TYPE_FILLING))+",";
   json+="\"timeTypeCode\":"+IntegerToString(HistoryOrderGetInteger(ticket,ORDER_TYPE_TIME))+",";
   json+="\"setupTimeMsc\":"+JsonLong(setup_time_msc)+",";
   json+="\"doneTimeMsc\":"+JsonLong(done_time_msc)+",";
   json+="\"expirationTimeMsc\":"+JsonLong(expiration_time_msc)+",";
   json+="\"setupAtUtc\":"+JsonString(BrokerMscToUtcIso(setup_time_msc,offset_minutes))+",";
   if(done_time_msc>0)
      json+="\"doneAtUtc\":"+JsonString(BrokerMscToUtcIso(done_time_msc,offset_minutes))+",";
   if(expiration_time_msc>0)
      json+="\"expirationAtUtc\":"+JsonString(BrokerMscToUtcIso(expiration_time_msc,offset_minutes))+",";
   json+="\"setupBrokerTimeText\":"+JsonString(BrokerMscToText(setup_time_msc))+",";
   json+="\"doneBrokerTimeText\":"+JsonString(done_time_msc>0 ? BrokerMscToText(done_time_msc) : "")+",";
   json+="\"brokerUtcOffsetMinutes\":"+IntegerToString(offset_minutes)+",";
   json+="\"volumeInitial\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_VOLUME_INITIAL),8)+",";
   json+="\"volumeCurrent\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_VOLUME_CURRENT),8)+",";
   json+="\"priceOpen\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_PRICE_OPEN),10)+",";
   json+="\"priceCurrent\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_PRICE_CURRENT),10)+",";
   json+="\"stopLimitPrice\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_PRICE_STOPLIMIT),10)+",";
   json+="\"stopLoss\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_SL),10)+",";
   json+="\"takeProfit\":"+JsonNumber(HistoryOrderGetDouble(ticket,ORDER_TP),10)+",";
   json+="\"comment\":"+JsonString(HistoryOrderGetString(ticket,ORDER_COMMENT))+",";
   json+="\"externalId\":"+JsonString(HistoryOrderGetString(ticket,ORDER_EXTERNAL_ID))+",";
   json+="\"isHistory\":true";
   json+="}";
   return json;
  }

string BuildActiveOrderJson(ulong ticket,int offset_minutes)
  {
   long setup_time_msc=OrderGetInteger(ORDER_TIME_SETUP_MSC);
   long expiration_time_msc=OrderGetInteger(ORDER_TIME_EXPIRATION)*1000;
   long order_type=OrderGetInteger(ORDER_TYPE);
   long order_state=OrderGetInteger(ORDER_STATE);
   long reason=OrderGetInteger(ORDER_REASON);
   string json="{";
   json+="\"orderTicket\":"+JsonUlong(ticket)+",";
   json+="\"positionIdentifier\":"+JsonLong(OrderGetInteger(ORDER_POSITION_ID))+",";
   json+="\"positionByIdentifier\":"+JsonLong(OrderGetInteger(ORDER_POSITION_BY_ID))+",";
   json+="\"magicNumber\":"+JsonLong(OrderGetInteger(ORDER_MAGIC))+",";
   json+="\"symbol\":"+JsonString(OrderGetString(ORDER_SYMBOL))+",";
   json+="\"orderTypeCode\":"+IntegerToString(order_type)+",";
   json+="\"orderType\":"+JsonString(OrderTypeName(order_type))+",";
   json+="\"orderStateCode\":"+IntegerToString(order_state)+",";
   json+="\"orderState\":"+JsonString(OrderStateName(order_state))+",";
   json+="\"reasonCode\":"+IntegerToString(reason)+",";
   json+="\"reason\":"+JsonString(OrderReasonName(reason))+",";
   json+="\"fillingTypeCode\":"+IntegerToString(OrderGetInteger(ORDER_TYPE_FILLING))+",";
   json+="\"timeTypeCode\":"+IntegerToString(OrderGetInteger(ORDER_TYPE_TIME))+",";
   json+="\"setupTimeMsc\":"+JsonLong(setup_time_msc)+",";
   json+="\"expirationTimeMsc\":"+JsonLong(expiration_time_msc)+",";
   json+="\"setupAtUtc\":"+JsonString(BrokerMscToUtcIso(setup_time_msc,offset_minutes))+",";
   if(expiration_time_msc>0)
      json+="\"expirationAtUtc\":"+JsonString(BrokerMscToUtcIso(expiration_time_msc,offset_minutes))+",";
   json+="\"setupBrokerTimeText\":"+JsonString(BrokerMscToText(setup_time_msc))+",";
   json+="\"brokerUtcOffsetMinutes\":"+IntegerToString(offset_minutes)+",";
   json+="\"volumeInitial\":"+JsonNumber(OrderGetDouble(ORDER_VOLUME_INITIAL),8)+",";
   json+="\"volumeCurrent\":"+JsonNumber(OrderGetDouble(ORDER_VOLUME_CURRENT),8)+",";
   json+="\"priceOpen\":"+JsonNumber(OrderGetDouble(ORDER_PRICE_OPEN),10)+",";
   json+="\"priceCurrent\":"+JsonNumber(OrderGetDouble(ORDER_PRICE_CURRENT),10)+",";
   json+="\"stopLimitPrice\":"+JsonNumber(OrderGetDouble(ORDER_PRICE_STOPLIMIT),10)+",";
   json+="\"stopLoss\":"+JsonNumber(OrderGetDouble(ORDER_SL),10)+",";
   json+="\"takeProfit\":"+JsonNumber(OrderGetDouble(ORDER_TP),10)+",";
   json+="\"comment\":"+JsonString(OrderGetString(ORDER_COMMENT))+",";
   json+="\"externalId\":"+JsonString(OrderGetString(ORDER_EXTERNAL_ID))+",";
   json+="\"isHistory\":false";
   json+="}";
   return json;
  }

string BuildSnapshotJson(string positions_json)
  {
   int offset_minutes=BrokerUtcOffsetMinutes();
   long server_time_msc=(long)TimeCurrent()*1000;
   string json="{";
   json+="\"capturedAtUtc\":"+JsonString(DateTimeToIso(TimeGMT()))+",";
   json+="\"serverTimeMsc\":"+JsonLong(server_time_msc)+",";
   json+="\"brokerTimeText\":"+JsonString(TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS))+",";
   json+="\"brokerUtcOffsetMinutes\":"+IntegerToString(offset_minutes)+",";
   json+="\"login\":"+JsonString(IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)))+",";
   json+="\"name\":"+JsonString(AccountInfoString(ACCOUNT_NAME))+",";
   json+="\"company\":"+JsonString(AccountInfoString(ACCOUNT_COMPANY))+",";
   json+="\"server\":"+JsonString(AccountInfoString(ACCOUNT_SERVER))+",";
   json+="\"currency\":"+JsonString(AccountInfoString(ACCOUNT_CURRENCY))+",";
   json+="\"leverage\":"+IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE))+",";
   json+="\"tradeModeCode\":"+IntegerToString(AccountInfoInteger(ACCOUNT_TRADE_MODE))+",";
   json+="\"marginModeCode\":"+IntegerToString(AccountInfoInteger(ACCOUNT_MARGIN_MODE))+",";
   json+="\"stopoutModeCode\":"+IntegerToString(AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE))+",";
   json+="\"balance\":"+JsonNumber(AccountInfoDouble(ACCOUNT_BALANCE),8)+",";
   json+="\"credit\":"+JsonNumber(AccountInfoDouble(ACCOUNT_CREDIT),8)+",";
   json+="\"equity\":"+JsonNumber(AccountInfoDouble(ACCOUNT_EQUITY),8)+",";
   json+="\"profit\":"+JsonNumber(AccountInfoDouble(ACCOUNT_PROFIT),8)+",";
   json+="\"margin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN),8)+",";
   json+="\"freeMargin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_FREE),8)+",";
   json+="\"marginLevel\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),8)+",";
   json+="\"marginSoCall\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_SO_CALL),8)+",";
   json+="\"marginSoStopout\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_SO_SO),8)+",";
   json+="\"tradeAllowed\":"+JsonBool((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))+",";
   json+="\"expertTradingAllowed\":"+JsonBool((bool)AccountInfoInteger(ACCOUNT_TRADE_EXPERT))+",";
   json+="\"connected\":"+JsonBool((bool)TerminalInfoInteger(TERMINAL_CONNECTED))+",";
   json+="\"positions\":"+positions_json;
   json+="}";
   return json;
  }

bool WriteJsonFile(string file_name,string json)
  {
   ResetLastError();
   int handle=FileOpen(file_name,FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
   if(handle==INVALID_HANDLE)
     {
      Print("EdgeVault bridge could not open ",file_name,". Error ",GetLastError());
      return false;
     }
   FileWriteString(handle,json);
   FileFlush(handle);
   FileClose(handle);
   return true;
  }

void WriteFailure(string message)
  {
   string json="{\"success\":false,\"jobId\":"+JsonString(EdgeVaultJobId)+",\"message\":"+JsonString(message)+",\"accountInfo\":{}}";
   if(WriteJsonFile(EdgeVaultResultFile,json)) failure_written=true;
  }

void WriteSnapshot()
  {
   long login=AccountInfoInteger(ACCOUNT_LOGIN);
   string json="{";
   json+="\"success\":true,";
   json+="\"jobId\":"+JsonString(EdgeVaultJobId)+",";
   json+="\"message\":\"MT5 account connected through the EdgeVault terminal bridge.\",";
   json+="\"accountInfo\":{";
   json+="\"login\":"+JsonString(IntegerToString(login))+",";
   json+="\"name\":"+JsonString(AccountInfoString(ACCOUNT_NAME))+",";
   json+="\"company\":"+JsonString(AccountInfoString(ACCOUNT_COMPANY))+",";
   json+="\"server\":"+JsonString(AccountInfoString(ACCOUNT_SERVER))+",";
   json+="\"currency\":"+JsonString(AccountInfoString(ACCOUNT_CURRENCY))+",";
   json+="\"balance\":"+JsonNumber(AccountInfoDouble(ACCOUNT_BALANCE),2)+",";
   json+="\"equity\":"+JsonNumber(AccountInfoDouble(ACCOUNT_EQUITY),2)+",";
   json+="\"margin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN),2)+",";
   json+="\"freeMargin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_FREE),2)+",";
   json+="\"tradeAllowed\":"+JsonBool((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))+",";
   json+="\"connected\":"+JsonBool((bool)TerminalInfoInteger(TERMINAL_CONNECTED))+",";
   json+="\"positions\":"+BuildLegacyPositionsJson();
   json+="}}";
   WriteJsonFile(EdgeVaultResultFile,json);
  }

bool StartHistoryCycle()
  {
   datetime from_time=0;
   datetime to_time=TimeCurrent();
   if(initial_history_complete && previous_sync_cycle_end>0)
      from_time=MathMax(0,previous_sync_cycle_end-EdgeVaultHistoryOverlapSeconds);
   ResetLastError();
   if(!HistorySelect(from_time,to_time))
     {
      Print("EdgeVault HistorySelect failed. Error ",GetLastError());
      return false;
     }
   sync_cycle_end=to_time;
   history_start_time_msc=(long)from_time*1000;
   history_deal_index=0;
   history_order_index=0;
   history_deal_total=HistoryDealsTotal();
   history_order_total=HistoryOrdersTotal();
   history_cycle_active=true;
   return true;
  }

void WriteSyncBatch()
  {
   if(EdgeVaultAccountId=="" || EdgeVaultSyncFile=="") return;
   if(FileIsExist(EdgeVaultSyncFile)) return;
   datetime now=TimeLocal();
   if(!history_cycle_active)
     {
      bool due=immediate_sync_requested || last_sync_cycle_at==0 || now-last_sync_cycle_at>=EdgeVaultIncrementalSyncSeconds;
      if(!due || !StartHistoryCycle()) return;
      immediate_sync_requested=false;
     }

   int offset_minutes=BrokerUtcOffsetMinutes();
   int batch_size=MathMax(1,MathMin(EdgeVaultHistoryBatchSize,200));
   int deal_index_before_batch=history_deal_index;
   int order_index_before_batch=history_order_index;
   long deal_time_before_batch=last_deal_time_msc;
   ulong deal_ticket_before_batch=last_deal_ticket;
   long order_time_before_batch=last_order_time_msc;
   string deals_json="[";
   int deals_added=0;
   while(history_deal_index<history_deal_total && deals_added<batch_size)
     {
      ulong ticket=HistoryDealGetTicket(history_deal_index++);
      if(ticket==0) continue;
      if(deals_added>0) deals_json+=",";
      deals_json+=BuildDealJson(ticket,offset_minutes);
      deals_added++;
     }
   deals_json+="]";

   string orders_json="[";
   int orders_added=0;
   while(history_order_index<history_order_total && orders_added<batch_size)
     {
      ulong ticket=HistoryOrderGetTicket(history_order_index++);
      if(ticket==0) continue;
      if(orders_added>0) orders_json+=",";
      orders_json+=BuildHistoryOrderJson(ticket,offset_minutes);
      orders_added++;
     }
   int active_total=OrdersTotal();
   int active_limit=MathMin(active_total,200);
   for(int index=0; index<active_limit; index++)
     {
      ulong ticket=OrderGetTicket(index);
      if(ticket==0) continue;
      if(orders_added>0) orders_json+=",";
      orders_json+=BuildActiveOrderJson(ticket,offset_minutes);
      orders_added++;
     }
   orders_json+="]";

   bool positions_complete=false;
   string positions_json=BuildSyncPositionsJson(positions_complete);
   bool cycle_complete=(history_deal_index>=history_deal_total && history_order_index>=history_order_total);
   bool reports_initial_complete=initial_history_complete || cycle_complete;
   bool include_account_snapshot=(last_account_snapshot_at==0 || now-last_account_snapshot_at>=EdgeVaultAccountSnapshotSeconds);
   string json="{";
   json+="\"schemaVersion\":1,";
   json+="\"workerId\":"+JsonString(EdgeVaultWorkerId)+",";
   json+="\"accountId\":"+JsonString(EdgeVaultAccountId)+",";
   json+="\"login\":"+JsonString(IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)))+",";
   json+="\"server\":"+JsonString(AccountInfoString(ACCOUNT_SERVER))+",";
   json+="\"snapshot\":"+(include_account_snapshot ? BuildSnapshotJson(positions_json) : "null")+",";
   json+="\"deals\":"+deals_json+",";
   json+="\"orders\":"+orders_json+",";
   json+="\"positions\":"+positions_json+",";
   json+="\"positionsComplete\":"+JsonBool(positions_complete)+",";
   json+="\"sync\":{";
   json+="\"initialHistoryComplete\":"+JsonBool(reports_initial_complete)+",";
   json+="\"historyStartTimeMsc\":"+JsonLong(history_start_time_msc)+",";
   json+="\"lastDealTimeMsc\":"+JsonLong(last_deal_time_msc)+",";
   json+="\"lastDealTicket\":"+JsonUlong(last_deal_ticket)+",";
   json+="\"lastOrderTimeMsc\":"+JsonLong(last_order_time_msc);
   json+="}}";

   if(!WriteJsonFile(EdgeVaultSyncFile,json))
     {
      history_deal_index=deal_index_before_batch;
      history_order_index=order_index_before_batch;
      last_deal_time_msc=deal_time_before_batch;
      last_deal_ticket=deal_ticket_before_batch;
      last_order_time_msc=order_time_before_batch;
      return;
     }
   if(cycle_complete)
     {
      initial_history_complete=true;
      history_cycle_active=false;
      previous_sync_cycle_end=sync_cycle_end;
      last_sync_cycle_at=now;
     }
   if(include_account_snapshot) last_account_snapshot_at=now;
  }

int OnInit()
  {
   started_at=TimeLocal();
   EventSetTimer(1);
   Print("EdgeVault terminal bridge v3 started for job ",EdgeVaultJobId);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTradeTransaction(const MqlTradeTransaction &transaction,const MqlTradeRequest &request,const MqlTradeResult &result)
  {
   immediate_sync_requested=true;
  }

void OnTimer()
  {
   bool connected=(bool)TerminalInfoInteger(TERMINAL_CONNECTED);
   long login=AccountInfoInteger(ACCOUNT_LOGIN);
   string actual_login=IntegerToString(login);
   if(connected && login>0)
     {
      if(EdgeVaultExpectedLogin!="" && actual_login!=EdgeVaultExpectedLogin)
        {
         if(!failure_written) WriteFailure("MT5 connected to login "+actual_login+" instead of requested login "+EdgeVaultExpectedLogin+".");
         return;
        }
      datetime now=TimeLocal();
      if(last_snapshot_at==0 || now-last_snapshot_at>=EdgeVaultSnapshotSeconds)
        {
         WriteSnapshot();
         last_snapshot_at=now;
        }
      WriteSyncBatch();
      return;
     }
   if(!failure_written && TimeLocal()-started_at>=EdgeVaultConnectTimeoutSeconds)
      WriteFailure("MT5 did not connect to the requested broker server before the timeout.");
  }
