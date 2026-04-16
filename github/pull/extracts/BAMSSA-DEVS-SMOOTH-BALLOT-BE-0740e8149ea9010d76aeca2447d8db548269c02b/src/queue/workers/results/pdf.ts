import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElectionData, ElectionResult } from "./type";
import * as PDFDocument from "pdfkit";
import * as fs from "fs";
import { S3_ENDPOINT } from "@env/index";

export class StructuredPdf {
    
    private readonly BLACK_COLOR = "#363939";
    private readonly ACCENT_COLOR = '#0654B0';

    private PAGE_WIDTH: number;
    private PAGE_HEIGHT: number;

    private readonly TABLE_TOP = 150;
    private readonly TABLE_LEFT = 40;
    private readonly ROW_HEIGHT = 30;
    private readonly TABLE_COLUMN_WIDTHS = [40, 300, 95, 95];

    private DOC: PDFKit.PDFDocument;
    private DATA: ElectionData;

    private file_name: string;

    constructor(file_name: string, data: ElectionData) {

        console.log(file_name);
        const doc = new PDFDocument();
        this.DOC = doc;

        this.PAGE_WIDTH = this.DOC.page.width;
        this.PAGE_HEIGHT = this.DOC.page.height;
        this.file_name = file_name; 

        this.DATA = data;

        console.log("<<<<<<<<<<<<<<<<<< Using the PDF CLASS >>>>>>>>>>>>>>>>>>>>")

    }


    make_pdf( file_name: string ) {

        const file_stream = fs.createWriteStream(`${file_name}`);

        file_stream.on("finish", async () => {
            console.log('finish file stream')
            await this.save_file_to_cloud_storage(fs.readFileSync(file_name), file_name)
        });

        this.DOC.pipe(file_stream);
        console.log('making pdf')
        this.make_cover_page(this.DATA.election_title);
        this.make_election_overview_page();
        this.make_results_page();
        this.DOC.end();
        console.log("Done making")
    }

    make_results_page() {
         
        console.log("making results page")

        this.DATA.election_results.forEach((result, i) => {
            this.make_result_page(result, i + 1, 1);
        });
    }

    make_result_page(election_result: ElectionResult, result_count: number, page = 1) {
        
        console.log("making result page")

        this.prepare_page();

        this.DOC.fontSize(18) // Set font size for the title
            .fillColor(this.ACCENT_COLOR) // Set font color
            .text(`${election_result.post_title} Election Result`.toUpperCase(), 40, 80); // Add title text

        this.DOC.fontSize(12)
            .font('font/Satoshi-Bold.otf')
            .fillColor(this.BLACK_COLOR)
            .text('Total Votes:', 40, 115, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${this.format_numbers(election_result.total_votes)}`);
        
        if( election_result.results.length === 0 && result_count < this.DATA.election_results.length ) return this.DOC.addPage();

        this.draw_table(election_result.results.slice(0, 18) as any, page);

        if (result_count < this.DATA.election_results.length) this.DOC.addPage();

        if (election_result.results.length > 18) {
            election_result.results = election_result.results.slice(18);
            return this.make_result_page(election_result, result_count, page + 1);
        }
    }

    make_cover_page(title: string) {

        console.log("making cover page")
        const textX = 50; // X coordinate for the text
        const textY = 300; // Y coordinate for the text

        this.prepare_page(true);

        this.DOC.font('font/Satoshi-Regular.otf');

        this.DOC.fontSize(24) // Set font size for the title
            .fillColor(this.ACCENT_COLOR) // Set font color
            .text('Election Result'.toUpperCase(), textX, textY); // Add title text

        this.DOC.fontSize(40) // Set font size for the subtitle
            .fillColor(this.BLACK_COLOR)
            .text(title.toUpperCase(), textX, textY + 40); // Add subtitle text below the title

        this.DOC.addPage();
    }

    make_election_overview_page() {

        console.log("making election overview")

        this.prepare_page();

        this.DOC.fontSize(18) // Set font size for the title
            .fillColor(this.ACCENT_COLOR) // Set font color
            .text('Election Overview'.toUpperCase(), 40, 80); // Add title text

        this.DOC
            .fontSize(12)
            .font("font/Satoshi-Bold.otf")
            .fillColor(this.BLACK_COLOR)
            .text("Election Title:", 40, 120, { continued: true })
            .font("font/Satoshi-Regular.otf")
            .text(` ${this.DATA.election_title}.`);

        this.DOC
            .fontSize(12)
            .font("font/Satoshi-Bold.otf")
            .fillColor(this.BLACK_COLOR)
            .text("Election Date:", 40, 150, { continued: true })
            .font("font/Satoshi-Regular.otf")
            .text(` ${this.DATA.election_date}.`);

        this.DOC
            .fontSize(12)
            .font("font/Satoshi-Bold.otf")
            .fillColor(this.BLACK_COLOR)
            .text("Total Registered Voters:", 40, 180, { continued: true })
            .font("font/Satoshi-Regular.otf")
            .text(` ${this.format_numbers(this.DATA.total_registered_voters)}.`);

        this.DOC
            .fontSize(12)
            .font("font/Satoshi-Bold.otf")
            .fillColor(this.BLACK_COLOR)
            .text("Voter Turnout:", 40, 210, { continued: true })
            .font("font/Satoshi-Regular.otf")
            .text(` ${this.format_numbers(this.DATA.voter_turnout)}.`);

        this.DOC
            .fontSize(12)
            .font("font/Satoshi-Bold.otf")
            .fillColor(this.BLACK_COLOR)
            .text("Voting Period:", 40, 240, { continued: true })
            .font("font/Satoshi-Regular.otf")
            .text(` ${this.DATA.voting_period}.`);

        this.DOC.addPage();
    }

    prepare_page(is_cover = false) {
        
        console.log("Preparing page")
        if (!is_cover) {
            const smallLineY = 60; // Y coordinate for the small line (adjust as needed)
            const smallLineX = 40; // X coordinate for the small line (distance from the left edge)

            this.DOC.lineWidth(5) // Set the width of the small line
                .strokeColor(this.ACCENT_COLOR) // Set the color of the small line (change as needed)
                .moveTo(smallLineX, smallLineY) // Start the small line at the specified X and Y coordinates
                .lineTo(smallLineX + 40, smallLineY) // End the small line, length determined by smallLineWidth
                .stroke(); // Draw the line
        }

        console.log("done again")


        this.DOC.lineWidth(20); // Set line width to 20 points
        this.DOC.strokeColor(this.ACCENT_COLOR); // Set line color to the desired blue

        this.DOC.moveTo(0, 0); // Move to the top-left corner of the page
        this.DOC.lineTo(this.PAGE_WIDTH, 0); // Line to the top-right corner of the page
        this.DOC.stroke(); // Draw the line

        console.log("done again to one")

        const imagePath = 'logo.png'; // Path to the image file
        const imageWidth = 100; // Width of the image (adjust as needed)
        const imageHeight = 100; // Height of the image (adjust as needed)

        // Calculate the position to place the image at the top right
        const imageX = this.PAGE_WIDTH - 120; // X coordinate for the image (right-aligned)
        const imageY = 10; // Y coordinate for the image (adjust as needed)

        this.DOC.image(imagePath, imageX, imageY, { width: imageWidth, height: imageHeight });

        this.DOC.lineWidth(80);
        this.DOC.moveTo(0, this.PAGE_HEIGHT); // Move to the bottom-left corner of the page
        this.DOC.lineTo(this.PAGE_WIDTH, this.PAGE_HEIGHT); // Line to the bottom-right corner of the page
        this.DOC.stroke(); // Draw the line
    }

    draw_table(results: Array<{ candidate_name: string; vote_received: number; percentage: number }>, page = 1) {
        console.log(page, "draw_table");

        this.draw_row(['S/N', 'Candidate name', 'Vote received', 'Percentage(%)'], true);

        this.draw_all_rows(results.map(res => Object.values(res)), page);
    }

    draw_all_rows(all_cells: Array<Array<string | number>>, page = 1) {
        console.log(page);
        all_cells.forEach((cells, i) => this.draw_row([((page - 1) * 18) + (i + 1)].concat(cells as any), false, i + 1));
    }

    draw_row(cells: Array<string | number>, isHeader = false, heightFactor = 1) {
        let y = this.TABLE_TOP + (isHeader ? 0 : (this.ROW_HEIGHT * heightFactor));
        let x = this.TABLE_LEFT;

        const lineWidth = isHeader ? 2 : 1;

        const fontSizePath = isHeader ? 'font/Satoshi-Bold.otf' : 'font/Satoshi-Regular.otf';

        this.DOC.lineWidth(lineWidth);

        // Draw cell borders and text
        cells.forEach((cell, i) => {
            const width = this.TABLE_COLUMN_WIDTHS[i];
            // Draw cell border
            this.DOC.rect(x, y, width, this.ROW_HEIGHT).strokeColor(this.BLACK_COLOR).stroke();
            // Draw cell text
            this.DOC.font(fontSizePath).fontSize(12).fillColor(this.BLACK_COLOR).text(this.parse_cell(cell) as any, x + 5, y + 5, { width: width - 10 });
            x += width; // Move to the next cell
        });
    }

    format_numbers(number: number): string {
        return new Intl.NumberFormat('en-NG', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    }

    parse_cell(val: string | number): string | number {
        return Number.isInteger(val) ? this.format_numbers(val as number) : val;
    }

    async save_file_to_cloud_storage(buffer: Buffer, file_name: string): Promise<void> {

        console.log("saving pdf to the cloud")

        const s3_client = new S3Client({
            region: 'auto',
            endpoint: S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        const params = {
            Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
            Body: buffer,
            Key: `results/${file_name}`,
            ContentType: "application/pdf",
        };

        const command = new PutObjectCommand(params);

        await s3_client.send(command);
    }
}