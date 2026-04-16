import { Process, Processor } from "@nestjs/bull";
import { CONTEST_REVENUE_REPORT_GENERATION_QUEUE } from "@queue/config";
import { Job } from "bull";
import * as  PDFDocument from 'pdfkit';
import * as fs from "fs";
import * as moment from "moment";
import * as crypto from "crypto";
import { format_currency, format_currency_without_symbol } from "@utils/format_currency";
import { StorageService } from "@modules/core/storage/storage.service";
import { ContestRepository } from "@modules/contest/repo";
import { ContestService } from "@modules/contest/service";
import { Logger } from "@nestjs/common";
import { ContestRevenueReportData } from "@modules/contest/type";
import { JobRepository } from "@modules/core/job/job.repo";
import slugify from "slugify";

@Processor(CONTEST_REVENUE_REPORT_GENERATION_QUEUE)
export default class ContestRevenueReportWorker {

    private logger: Logger = new Logger(ContestRevenueReportWorker.name)

    constructor(
        private storage_service: StorageService,
        private contest_repo: ContestRepository,
        private contest_service: ContestService,
        private job_repo: JobRepository,
        
    ){}

    @Process()
    async process(job: Job<{ contest_id: number, job_id: number }>){

        const data = await this.contest_service.get_contest_report_data( job.data.contest_id );

        const file_name = `${data.contest.contest_slug}-${crypto.randomUUID()}`;

        const file_url = `https://storage.smoothballot.com/contest-reports/${file_name}`

        const file_stream = fs.createWriteStream(file_name);

        const instance = new PDFDocument();

        const buffers: Buffer[] = [];

        instance.pipe( file_stream );

        instance.on("data", (data: Buffer) => buffers.push(data));

        const stream_closed_event_callback: typeof this.save_file_and_update_contest = this.save_file_and_update_contest.bind(this);

        instance.on("close", async ()=>{
            await stream_closed_event_callback({
                buffers,
                job_id: job.data.job_id,
                file_name,
                file_url,
                contest_id: job.data.contest_id
            })
        })

        this.generate_pdf(data, instance);
        
    }

    async generate_pdf( data: ContestRevenueReportData, doc: typeof PDFDocument ){

        // Nigerian time
        const hour_offset = (moment().utcOffset() / 60) - 1;

        const BLACK_COLOR = "#363939";
        const ACCENT_COLOR = '#0654B0';
        const WHITE_COLOR = '#FFFFFF';

        // Get the page width and height
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Set the line width and color
        doc.lineWidth(20); // Set line width to 20 points
        doc.strokeColor(ACCENT_COLOR); // Set line color to the desired blue

        // Draw the line across the top of the page
        doc.moveTo(0, 0); // Move to the top-left corner of the page
        doc.lineTo(pageWidth, 0); // Line to the top-right corner of the page
        doc.stroke(); // Draw the line

        // Add an image at the top right of the page
        const imagePath = 'logo.png'; // Path to the image file
        const imageWidth = 100; // Width of the image (adjust as needed)
        const imageHeight = 100; // Height of the image (adjust as needed)

        // Calculate the position to place the image at the top right
        const imageX = pageWidth - 120; // X coordinate for the image (right-aligned)
        const imageY = 10; // Y coordinate for the image (adjust as needed)

        doc.image(imagePath, imageX, imageY, { width: imageWidth, height: imageHeight });

        const textX = 50; // X coordinate for the text
        const textY = 100; // Y coordinate for the text

        doc.font('font/Satoshi-Regular.otf')

        doc.fontSize(18) // Set font size for the title
        .fillColor(ACCENT_COLOR) // Set font color
        .text('Contest Revenue Report'.toUpperCase(), textX, textY); // Add title text

        doc.moveTo(50, 125)
        doc.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text('Contest Name: ', 51, 133, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${data.contest.contest_name}`)

        doc.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text("Organizer's Name: ", 51, 153, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${data.contest.contest_organizer}`)
        doc.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text("Organizer's Email: ", 51, 173, { continued: true }).font('font/Satoshi-Regular.otf').text(`  ${data.contest.contest_organizer_email}`)

        doc.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text("Date Generated: ", 51, 193, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${moment().subtract(hour_offset, "hour").format("YYYY-MM-DD hh:mm A")}`)

        doc.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text("Total Revenue: ", 51, 213, { continued: true }).font('font/Satoshi-Regular.otf').text(`  N${format_currency_without_symbol(data.contest.total_revenue)}`)
        
        doc.moveTo(51, 250)
        doc.lineWidth(14); // Set line width to 20 points
        doc.strokeColor(ACCENT_COLOR); // Set line color to the desired blue

        doc.lineTo(pageWidth - 40 , 250)
        doc.stroke()

        doc.lineWidth(1)
        doc.rect(51, 243.5, 95, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Date', 59, 244.5)

        doc.lineWidth(1)
        doc.rect(146, 243.5, 100, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Amount', 154, 244.5)

        doc.lineWidth(1)
        doc.rect(146, 243.5, 100, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Amount (NGN)', 154, 244.5)

        doc.lineWidth(1)
        doc.rect(246, 243.5, 110, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Date Transferred', 254, 244.5)

        doc.lineWidth(1)
        doc.rect(356, 243.5, 110, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Recieving Account Number', 364, 244.5);

        doc.lineWidth(1)
        doc.rect(466, 243.5, 106, 13).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Recieving Bank', 475, 244.5);

        let rowY = 257;

        let transactions = data.transactions
        // First page
        for (let transaction of transactions.slice(0, 35) ){
        let fieldY = rowY + 2;
        doc.rect(51, rowY, 95, 13).stroke("#D3D3D3").stroke()
        doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(moment(transaction.createdAt.toISOString()).subtract(hour_offset, "hour").format("YYYY-MM-DD hh:mm A"), 59, fieldY)
        doc.rect(146, rowY, 100, 13).stroke("#D3D3D3").stroke()
        doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(format_currency_without_symbol(transaction.amount), 158, fieldY)
        doc.rect(246, rowY, 110, 13).stroke("#D3D3D3").stroke()
        doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(moment(transaction.transfer_confirmation_date).subtract(hour_offset, "hour").format("YYYY-MM-DD hh:mm A"), 255, fieldY)
        doc.rect(356, rowY, 110, 13).stroke("#D3D3D3").stroke()
        doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(transaction.account_number, 365, fieldY)
        doc.rect(466, rowY, 106, 13).stroke("#D3D3D3").stroke()
        doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(transaction.bank_name.substring(0, 30), 475, fieldY, { lineBreak: false })

        rowY += 13
        }

        const transactions_for_other_pages = transactions.slice(35);

        const transactions_per_page = 45

        const no_of_pages = Math.ceil(transactions_for_other_pages.length / transactions_per_page);

        for( let i = 1; i <= no_of_pages; i++ ){
        doc.addPage()
        // Set the line width and color
        doc.lineWidth(20); // Set line width to 20 points
        doc.strokeColor(ACCENT_COLOR); // Set line color to the desired blue

        // Draw the line across the top of the page
        doc.moveTo(0, 0); // Move to the top-left corner of the page
        doc.lineTo(pageWidth, 0); // Line to the top-right corner of the page
        doc.stroke(); // Draw the line

        doc.image(imagePath, imageX, imageY, { width: imageWidth, height: imageHeight });

        doc.moveTo(51, 120)
        doc.lineWidth(14); // Set line width to 20 points
        doc.strokeColor(ACCENT_COLOR); // Set line color to the desired blue

        doc.lineTo(pageWidth - 40 , 120)
        doc.stroke()

        let cellY = 112.5;
        let cellHeight = 14;
        let fieldY= cellY + 1.5;

        doc.lineWidth(1)
        doc.rect(51, cellY, 95, cellHeight).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Date', 59, fieldY)

        doc.lineWidth(1)
        doc.rect(146, cellY, 100, cellHeight).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Amount (NGN)', 154, fieldY)

        doc.lineWidth(1)
        doc.rect(246, cellY, 110, cellHeight).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Date Transferred', 254, fieldY)

        doc.lineWidth(1)
        doc.rect(356, cellY, 110, cellHeight).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Recieving Account Number', 364, fieldY);

        doc.lineWidth(1)
        doc.rect(466, cellY, 106, cellHeight).strokeColor("#D3D3D3").stroke()

        doc.fontSize(8)
        .font('font/Satoshi-Regular.otf')
        .fillColor(WHITE_COLOR)
        .text('Recieving Bank', 475, fieldY);

        let rowY = 126;
        const transactions_for_this_page = transactions_for_other_pages.slice((i - 1) * transactions_per_page, transactions_per_page * i);

        for( let transaction of transactions_for_this_page ){
            let fieldY = rowY + 2;
            // Each doc.rect is positioned x(n) = x(n-1) + cell_width(n-1)
            doc.rect(51, rowY, 95, 13).stroke("#D3D3D3").stroke()
            doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(moment(transaction.createdAt).subtract(hour_offset, "hour").format("YYYY-MM-DD hh:mm A"), 59, fieldY)
            doc.rect(146, rowY, 100, 13).stroke("#D3D3D3").stroke()
            doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(format_currency_without_symbol(transaction.amount), 158, fieldY)
            doc.rect(246, rowY, 110, 13).stroke("#D3D3D3").stroke()
            doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(moment(transaction.transfer_confirmation_date).subtract(hour_offset, "hour").format("YYYY-MM-DD hh:mm A"), 255, fieldY)
            doc.rect(356, rowY, 110, 13).stroke("#D3D3D3").stroke()
            doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(transaction.account_number, 365, fieldY)
            doc.rect(466, rowY, 106, 13).stroke("#D3D3D3").stroke()
            doc.fontSize(7).font('font/Satoshi-Regular.otf').fillColor(BLACK_COLOR).text(transaction.bank_name.substring(0, 30), 475, fieldY, { lineBreak: false })
            rowY += 13
        }

        }

        doc.end()

    }

    async save_file_and_update_contest( payload: SaveFileAndUpdateDatabase ){

        this.logger.debug("Contest Revenue report callback invoked")

        await this.contest_repo.udpdate_contest({
                report: {
                    url: payload.file_url,
                    expiry: moment().add(10, 'minutes').toISOString()
                }
            },
            {
                id: payload.contest_id
            }
        )

        await this.job_repo.update_job(payload.job_id, { status: "done" })

        await this.storage_service.save_file(Buffer.concat(payload.buffers), `contest-reports/${payload.file_name}`, "application/pdf")

    }

    
}

interface SaveFileAndUpdateDatabase {
  contest_id: number;
  file_url: string;
  file_name: string;
  buffers: Buffer[];
  job_id: number;
}

