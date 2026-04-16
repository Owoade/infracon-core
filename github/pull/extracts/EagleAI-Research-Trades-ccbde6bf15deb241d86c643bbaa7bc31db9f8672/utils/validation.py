from typing import Literal, Optional

from pydantic import BaseModel, Field


class OrderRequest(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"]
    size: float = Field(..., gt=0)
    type: Literal["MARKET", "LIMIT", "TAKE_PROFIT_MARKET", "STOP_LIMIT"]
    isPositionTpsl: bool = False
    reduceOnly: bool = False
    orderPrice: Optional[float] = None
    price: Optional[float | str] = None
    triggerPrice: Optional[float] = None
    triggerPriceType: Optional[Literal["INDEX", "LAST", "MARK"]] = None
    tpPrice: Optional[float] = None
    slPrice: Optional[float] = None
    retry: Optional[bool] = False


class TpslRequest(BaseModel):
    side: Literal["BUY", "SELL"]
    size: float = Field(..., gt=0)
    tpPrice: Optional[float] = None
    slPrice: Optional[float] = None
    triggerPriceType: Optional[Literal["INDEX", "LAST", "MARK"]] = "MARK"


class MarginRequest(BaseModel):
    symbol: str
    rate: str
