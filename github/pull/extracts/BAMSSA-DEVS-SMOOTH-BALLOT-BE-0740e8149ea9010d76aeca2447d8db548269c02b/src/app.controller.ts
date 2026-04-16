import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import * as moment from 'moment';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('/dev/info')
  getInfo(){
    const date = moment("2025-08-18T23:40:00.000Z");
    console.log(date.hour())
    return {
      date: moment().toISOString(),
      hour: moment().hour(),
      offset: moment().utcOffset(),
      "12 o clock": moment().set("hour", 12).toISOString(),
      "12_hour": moment().set("hour", 12).hour(),
      "comparism": moment().set("hours", 12).set("minutes", 31).diff(moment("2024-11-26T11:29:00.000Z"))
    }
  }
}
