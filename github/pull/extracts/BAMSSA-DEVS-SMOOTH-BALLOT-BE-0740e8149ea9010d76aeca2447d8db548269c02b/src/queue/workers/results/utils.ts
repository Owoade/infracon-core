import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { ElectionData, ElectionResult } from './type';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const TABLE_TOP = 150;
const TABLE_LEFT = 40;
const ROW_HEIGHT = 30;
const TABLE_COLUMN_WIDTHS = [40, 300, 95, 95];
const BLACK_COLOR = "#363939";
const ACCENT_COLOR = '#0654B0';

let PAGE_WIDTH: number;
let PAGE_HEIGHT: number;


async function generate_pdf( DATA: ElectionData, file_name: string ){

    const file_stream = fs.createWriteStream(file_name);

    const instance = new PDFDocument();

    PAGE_HEIGHT = instance.page.height;
    PAGE_WIDTH = instance.page.width;

    const buffers: Buffer[] = [];

    instance.pipe( file_stream );

    instance.on("data", (data: Buffer) => buffers.push(data));

    instance.on("close", async ()=>{
        await save_file_to_cloud_storage(Buffer.concat(buffers), file_name );
    })

    make_pdf(instance, DATA)

}

function make_pdf( instance: PDFKit.PDFDocument, data: ElectionData ){

    make_cover_page( instance, data.election_title );
    make_election_overview_page( instance, data );
    make_results_page( data, instance )
    instance.end();

}

function make_cover_page( instance: PDFKit.PDFDocument, title: string ) {

  console.log("making cover page");
  const textX = 50; // X coordinate for the text
  const textY = 300; // Y coordinate for the text

  prepare_page(instance, true);

  instance.font("font/Satoshi-Regular.otf");

  instance
    .fontSize(24) // Set font size for the title
    .fillColor(ACCENT_COLOR) // Set font color
    .text("Election Result".toUpperCase(), textX, textY); // Add title text

  instance
    .fontSize(40) // Set font size for the subtitle
    .fillColor(BLACK_COLOR)
    .text(title.toUpperCase(), textX, textY + 40); // Add subtitle text below the title

  instance.addPage();

}

function prepare_page( instance: PDFKit.PDFDocument, is_cover=false ){

    console.log("Preparing page")
        if (!is_cover) {
            const smallLineY = 60; // Y coordinate for the small line (adjust as needed)
            const smallLineX = 40; // X coordinate for the small line (distance from the left edge)

            instance.lineWidth(5) // Set the width of the small line
                .strokeColor(ACCENT_COLOR) // Set the color of the small line (change as needed)
                .moveTo(smallLineX, smallLineY) // Start the small line at the specified X and Y coordinates
                .lineTo(smallLineX + 40, smallLineY) // End the small line, length determined by smallLineWidth
                .stroke(); // Draw the line
        }

        console.log("done again")


        instance.lineWidth(20); // Set line width to 20 points
        instance.strokeColor(ACCENT_COLOR); // Set line color to the desired blue

        instance.moveTo(0, 0); // Move to the top-left corner of the page
        instance.lineTo(PAGE_WIDTH, 0); // Line to the top-right corner of the page
        instance.stroke(); // Draw the line

        console.log("done again to one")

        const imagePath = 'logo.png'; // Path to the image file
        const imageWidth = 100; // Width of the image (adjust as needed)
        const imageHeight = 100; // Height of the image (adjust as needed)

        // Calculate the position to place the image at the top right
        const imageX = PAGE_WIDTH - 120; // X coordinate for the image (right-aligned)
        const imageY = 10; // Y coordinate for the image (adjust as needed)

        instance.image(imagePath, imageX, imageY, { width: imageWidth, height: imageHeight });

        instance.lineWidth(80);
        instance.moveTo(0, PAGE_HEIGHT); // Move to the bottom-left corner of the page
        instance.lineTo(PAGE_WIDTH, PAGE_HEIGHT); // Line to the bottom-right corner of the page
        instance.stroke(); // Draw the line

}

function make_election_overview_page( instance: PDFKit.PDFDocument, data: ElectionData ) {

    console.log("making election overview")

    prepare_page(instance);

    instance.fontSize(18) // Set font size for the title
        .fillColor(ACCENT_COLOR) // Set font color
        .text('Election Overview'.toUpperCase(), 40, 80); // Add title text

    instance
        .fontSize(12)
        .font("font/Satoshi-Bold.otf")
        .fillColor(BLACK_COLOR)
        .text("Election Title:", 40, 120, { continued: true })
        .font("font/Satoshi-Regular.otf")
        .text(` ${data.election_title}.`);

    instance
        .fontSize(12)
        .font("font/Satoshi-Bold.otf")
        .fillColor(BLACK_COLOR)
        .text("Election Date:", 40, 150, { continued: true })
        .font("font/Satoshi-Regular.otf")
        .text(` ${data.election_date}.`);

    instance
        .fontSize(12)
        .font("font/Satoshi-Bold.otf")
        .fillColor(BLACK_COLOR)
        .text("Total Registered Voters:", 40, 180, { continued: true })
        .font("font/Satoshi-Regular.otf")
        .text(` ${format_numbers(data.total_registered_voters)}.`);

    instance
        .fontSize(12)
        .font("font/Satoshi-Bold.otf")
        .fillColor(BLACK_COLOR)
        .text("Voter Turnout:", 40, 210, { continued: true })
        .font("font/Satoshi-Regular.otf")
        .text(` ${format_numbers(data.voter_turnout)}.`);

    instance
        .fontSize(12)
        .font("font/Satoshi-Bold.otf")
        .fillColor(BLACK_COLOR)
        .text("Voting Period:", 40, 240, { continued: true })
        .font("font/Satoshi-Regular.otf")
        .text(` ${data.voting_period}.`);

    instance.addPage();

}

       
function make_results_page( data: ElectionData, instance: PDFKit.PDFDocument ) {
         
    console.log("making results page")

    data.election_results.forEach((result, i) => {
        make_result_page(data, instance, result, i + 1, 1);
    });

}

function make_result_page( data: ElectionData, instance: PDFKit.PDFDocument, election_result: ElectionResult, result_count: number, page = 1) {
        
    console.log("making result page")

    prepare_page(instance);

    instance.fontSize(18) // Set font size for the title
        .fillColor(ACCENT_COLOR) // Set font color
        .text(`${election_result.post_title} Election Result`.toUpperCase(), 40, 80); // Add title text

    instance.fontSize(12)
        .font('font/Satoshi-Bold.otf')
        .fillColor(BLACK_COLOR)
        .text('Total Votes:', 40, 115, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${format_numbers(election_result.total_votes)}`);
    
    if( election_result.results.length === 0 && result_count < data.election_results.length ) return instance.addPage();

    draw_table(data, instance, election_result.results.slice(0, 18) as any, page);

    if (result_count < data.election_results.length) instance.addPage();

    if (election_result.results.length > 18) {
        election_result.results = election_result.results.slice(18);
        return make_result_page(data, instance, election_result, result_count, page + 1);
    }
}

function draw_table(data: ElectionData, instance: PDFKit.PDFDocument, results: Array<{ candidate_name: string; vote_received: number; percentage: number }>, page = 1) {

    console.log(page, "draw_table");

    draw_row(data, instance, ['S/N', 'Candidate name', 'Vote received', data.ELECTION_VOTE_IS_WEIGHTED ? 'Vote Weight' : 'Percentage(%)'], true);

    draw_all_rows(data, instance, results.map(res => Object.values(res)), page);
}

function draw_all_rows(data: ElectionData, instance: PDFKit.PDFDocument, all_cells: Array<Array<string | number>>, page = 1) {
    console.log(page);
    all_cells.forEach((cells, i) => draw_row(data, instance, [((page - 1) * 18) + (i + 1)].concat(cells as any), false, i + 1));
}

function draw_row( data: ElectionData, instance: PDFKit.PDFDocument, cells: Array<string | number>, isHeader = false, heightFactor = 1) {
    console.log({cells})


    let y = TABLE_TOP + (isHeader ? 0 : (ROW_HEIGHT * heightFactor));
    let x = TABLE_LEFT;

    const lineWidth = isHeader ? 2 : 1;

    const fontSizePath = isHeader ? 'font/Satoshi-Bold.otf' : 'font/Satoshi-Regular.otf';

    if( !isHeader ){

        if( data.ELECTION_VOTE_IS_WEIGHTED )
            cells = cells.filter( (cell, i) => i !== 4 )
        else  cells = cells.filter( (cell, i) => i !== 3 );
    
    }

    instance.lineWidth(lineWidth);

    // Draw cell borders and text
    cells.forEach((cell, i) => {
        const width = TABLE_COLUMN_WIDTHS[i];
        console.log({
            x, y, width, ROW_HEIGHT,i, cells
        })
        // Draw cell border
        instance.rect(x, y, width, ROW_HEIGHT).strokeColor(BLACK_COLOR).stroke();
        // Draw cell text
        instance.font(fontSizePath).fontSize(12).fillColor(BLACK_COLOR).text(parse_cell(cell) as any, x + 5, y + 5, { width: width - 10 });
        x += width; // Move to the next cell
    });
}
function parse_cell(val: number | string) {
    return Number.isInteger(val) ? format_numbers(val as number) : val;
}

function format_numbers(number: number) {

    return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);

}

async function save_file_to_cloud_storage(buffer: Buffer, file_name: string): Promise<void> {

        console.log("saving pdf to the cloud")

        const s3_client = new S3Client({
            region: 'auto',
            endpoint: process.env.S3_ENDPOINT,
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

export default generate_pdf;