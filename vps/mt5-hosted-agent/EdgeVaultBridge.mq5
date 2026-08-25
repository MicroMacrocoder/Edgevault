#property copyright "EdgeVault"
#property version   "2.00"
#property strict

input string EdgeVaultJobId = "";
input string EdgeVaultExpectedLogin = "";
input string EdgeVaultTerminalSlot = "Slot01";
input string EdgeVaultResultFile = "edgevault_bridge_result.json";
input int EdgeVaultConnectTimeoutSeconds = 150;
input int EdgeVaultSnapshotSeconds = 5;

datetime started_at = 0;
datetime last_snapshot_at = 0;
bool failure_written = false;

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
string JsonNumber(double value,int digits=2) { return DoubleToString(value,digits); }

string BuildPositionsJson()
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
      json+="\"volume\":"+JsonNumber(PositionGetDouble(POSITION_VOLUME),2)+",";
      json+="\"priceOpen\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_OPEN),8)+",";
      json+="\"priceCurrent\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT),8)+",";
      json+="\"stopLoss\":"+JsonNumber(PositionGetDouble(POSITION_SL),8)+",";
      json+="\"takeProfit\":"+JsonNumber(PositionGetDouble(POSITION_TP),8)+",";
      json+="\"profit\":"+JsonNumber(PositionGetDouble(POSITION_PROFIT),2)+",";
      json+="\"swap\":"+JsonNumber(PositionGetDouble(POSITION_SWAP),2)+",";
      json+="\"openedAt\":"+IntegerToString(PositionGetInteger(POSITION_TIME))+",";
      json+="\"comment\":"+JsonString(PositionGetString(POSITION_COMMENT));
      json+="}";
     }
   return json+"]";
  }

bool WriteJson(string json)
  {
   ResetLastError();
   int handle=FileOpen(EdgeVaultResultFile,FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);
   if(handle==INVALID_HANDLE)
     {
      Print("EdgeVault bridge could not open result file. Error ",GetLastError());
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
   if(WriteJson(json)) failure_written=true;
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
   json+="\"positions\":"+BuildPositionsJson();
   json+="}}";
   WriteJson(json);
  }

int OnInit()
  {
   started_at=TimeLocal();
   EventSetTimer(1);
   Print("EdgeVault terminal bridge started for job ",EdgeVaultJobId);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); }

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
      return;
     }
   if(!failure_written && TimeLocal()-started_at>=EdgeVaultConnectTimeoutSeconds)
      WriteFailure("MT5 did not connect to the requested broker server before the timeout.");
  }