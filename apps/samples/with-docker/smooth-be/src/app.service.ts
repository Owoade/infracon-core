import { Injectable } from '@nestjs/common';
import * as QRCode from "qrcode";
@Injectable()
export class AppService {

  getHello(): string {
    QRCode.toFile(
      "qrcode.png",
      "https://api.smoothballot.com/ticket/validate/12/12sinviiovob",
      {
        width: 100,
        margin: 2,
      }
    );
    return 'Welcome again again, Smooth ballot v1 🚀';
  }

}
