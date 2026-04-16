import { Process, Processor } from "@nestjs/bull";
import { EXPORT_RESULT_QUEUE } from "src/queue/config";
import * as fs from "fs";
import * as PDFDocument from 'pdfkit';
import { ElectionData, ElectionResult } from "./type";
import { StorageService } from "@modules/core/storage/storage.service";
import * as crypto from "crypto";
import { ElectionRepository } from "@modules/election/election.repo";
import * as  moment from "moment";
import { VotersRepository } from "@modules/election/voters/repo";
import { ChildOf } from "@utils/schema";
import { Job } from "bull";
import { JobRepository } from "@modules/core/job/job.repo";
import { EmailService } from "@modules/core/email/email.service";
import { Logger } from "@nestjs/common";
import { StructuredPdf } from "./pdf";
import generate_pdf from "./utils";



@Processor(EXPORT_RESULT_QUEUE)
export class ExportResultWorker {
    private readonly BLACK_COLOR = "#363939";
    private readonly ACCENT_COLOR = '#0654B0';

    private logger  = new Logger(ExportResultWorker.name)

    private PAGE_WIDTH: number;
    private PAGE_HEIGHT: number;

    private readonly TABLE_TOP = 150;
    private readonly TABLE_LEFT = 40;
    private readonly ROW_HEIGHT = 30;
    private readonly TABLE_COLUMN_WIDTHS = [40, 300, 95, 95];

    private DOC: PDFKit.PDFDocument;
    private DATA: ElectionData;

    private FILE_NAME: string;

    constructor(
        private storage_service: StorageService,
        private election_repo: ElectionRepository,
        private voter_repo: VotersRepository,
        private job_repo: JobRepository,
        private email_service: EmailService
    ) {

        this.logger.debug("EXPORT RESULT WORKER INITIATED");
    }

    @Process()
    async process(job: Job){

        const { election_id, name, job_id, election_title, email, slug } = job.data;

        this.logger.log(`Starting job ${job.id} processing`);

        this.DATA = await this.get_data(election_id);

        this.FILE_NAME = `${slug}-${crypto.randomUUID()}.pdf`;

        generate_pdf( this.DATA, this.FILE_NAME )

        await Promise.all([

            this.election_repo.update_election({ result: {
                link: `https://storage.smoothballot.com/results/${this.FILE_NAME}`,
                id: this.FILE_NAME
            }}, { id: job.data.election_id }),
    
            this.job_repo.update_job( job_id, { status: 'done' }),
    
            this.email_service.send_result({
                email,
                name,
                result_link: `https://storage.smoothballot.com/results/${this.FILE_NAME}`,
                election_title
            })
    
        ])

    }

   async make_pdf( election_id: number ) {
    
        this.logger.debug("making pdf");
        this.DATA = await this.get_data(election_id)
        this.DOC = new PDFDocument();
        this.FILE_NAME = crypto.randomUUID();
        const file_stream = fs.createWriteStream(`${this.FILE_NAME}.pdf`);

        this.DOC.pipe(file_stream);

        this.PAGE_WIDTH = this.DOC.page.width;
        this.PAGE_HEIGHT = this.DOC.page.height;

        this.make_cover_page(this.DATA.election_title);
        this.make_election_overview_page();
        this.make_results_page();
        this.DOC.end();
    }

    make_results_page() {
        this.logger.debug("making results page")
        this.DATA.election_results.forEach((result, i) => {
            this.make_result_page(result, i + 1, 1);
        });
    }

    make_result_page(election_result: ElectionResult, result_count: number, page = 1) {
        this.logger.debug("making result page")
        this.prepare_page();

        this.DOC.fontSize(18) // Set font size for the title
            .fillColor(this.ACCENT_COLOR) // Set font color
            .text(`${election_result.post_title} Election Result`.toUpperCase(), 40, 80); // Add title text

        this.DOC.fontSize(12)
            .font('font/Satoshi-Bold.otf')
            .fillColor(this.BLACK_COLOR)
            .text('Total Votes:', 40, 115, { continued: true }).font('font/Satoshi-Regular.otf').text(` ${this.format_numbers(election_result.total_votes)}`);

        this.draw_table(election_result.results.slice(0, 18) as any[], page);

        if (result_count < this.DATA.election_results.length) this.DOC.addPage();

        console.log({result_count, length:this.DATA.election_results.length})

        if (election_result.results.length > 18) {
            election_result.results = election_result.results.slice(18);
            return this.make_result_page(election_result, result_count, page + 1);
        }
    }

    make_cover_page(title: string) {
        this.logger.debug("making cover page")
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
        this.logger.debug("making election overview page")
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
        if (!is_cover) {
            const smallLineY = 60; // Y coordinate for the small line (adjust as needed)
            const smallLineX = 40; // X coordinate for the small line (distance from the left edge)

            this.DOC.lineWidth(5) // Set the width of the small line
                .strokeColor(this.ACCENT_COLOR) // Set the color of the small line (change as needed)
                .moveTo(smallLineX, smallLineY) // Start the small line at the specified X and Y coordinates
                .lineTo(smallLineX + 40, smallLineY) // End the small line, length determined by smallLineWidth
                .stroke(); // Draw the line
        }

        this.DOC.lineWidth(20); // Set line width to 20 points
        this.DOC.strokeColor(this.ACCENT_COLOR); // Set line color to the desired blue

        this.DOC.moveTo(0, 0); // Move to the top-left corner of the page
        this.DOC.lineTo(this.PAGE_WIDTH, 0); // Line to the top-right corner of the page
        this.DOC.stroke(); // Draw the line

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

    draw_table(results: Array<{ candidate_name: string; vote_received: number; percentage: number, weight: number }>, page = 1) {
        console.log(page, "draw_table");

        this.draw_row(['S/N','Candidate name', 'Vote received', this.DATA.ELECTION_VOTE_IS_WEIGHTED ? 'Weight' : 'Percentage(%)' ], true);

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

        if( this.DATA.ELECTION_VOTE_IS_WEIGHTED )
            delete cells[3]
        else  delete cells[4];

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

    async get_data( election_id: number ){

        const election = await this.election_repo.get_one_election_by_filter({ id: election_id }, ['name', 'election_date', 'start_time', 'end_time', 'election_vote_weight_attribute']);

        const total_voters = await this.voter_repo.get_voters_count({
            ElectionId: election_id
        })

        const voters_turnout = await this.voter_repo.get_voters_count({
            has_voted: true,
            ElectionId: election_id
        })

        const election_results = await this.build_election_result(election_id);

        console.log(election_results)
        
        console.log("waiting on the data", {
            election_title: election.name,
            election_date: election.election_date,
            voting_period: 'hello there',
            total_registered_voters: total_voters,
            voter_turnout: voters_turnout,
            election_results
        }
)


        const election_data: ElectionData = {
            election_title: election.name,
            ELECTION_VOTE_IS_WEIGHTED: election.election_vote_weight_attribute !== null,
            election_date: moment(election.election_date).format('MMMM Do YYYY').toUpperCase(),
            voting_period: `${moment(election.start_time).format('MMMM Do YYYY, hh:mm a')} - ${moment(election.end_time).format('MMMM Do YYYY, hh:mm a')}`.toUpperCase(),
            total_registered_voters: total_voters,
            voter_turnout: voters_turnout,
            election_results
        }

        console.log( election_data )

        return election_data;

    }

    async build_election_result( election_id: number ){

        const election_posts = await this.election_repo.get_election_posts_by_filter({ ElectionId: election_id }, ['title', 'id']);

        let election_results = [] as ElectionResult[];

        for( let post of election_posts ){

            const total_votes = await this.voter_repo.get_votes_count({ ElectionPostId: post.id });

            let payload = { } as ChildOf<ElectionResult[]>

            payload.total_votes = total_votes;

            payload.post_title = post.title;

            let results = [] as ElectionResult['results'];

            const candidates = await this.election_repo.get_all_candidates({ ElectionId: election_id, ElectionPostId: post.id });

            for( let _candidate of candidates ){

                let result = {} as ChildOf<ElectionResult['results']>;

                const candidate = _candidate.toJSON();
                
                result.candidate_name = candidate.name;

                const vote_recieved = await this.voter_repo.get_votes_count({
                    CandidateId: candidate.id,
                    ElectionPostId: post.id
                })

                const vote_weights_recieved = await this.voter_repo.get_votes_count({
                    CandidateId: candidate.id,
                    ElectionPostId: post.id
                })

                result.vote_received = vote_recieved;

                result.weight = vote_weights_recieved ?? 1;

                const _percentage = ((vote_recieved/total_votes) * 100) || 0;

                result.percentage = Number.isInteger(_percentage) ? _percentage.toString() : _percentage.toFixed(2);

                results.push(result)

            }

            const void_votes = await this.voter_repo.get_votes_count({
                CandidateId: null,
                ElectionPostId: post.id
            })

            const null_vote_weights_recieved = await this.voter_repo.get_votes_count({
                CandidateId: null,
                ElectionPostId: post.id
            })

            if (results.length > 0)
              results.push({
                candidate_name: 'VOID',
                vote_received: void_votes,
                percentage: ((void_votes / total_votes) * 100).toFixed(2),
                weight: null_vote_weights_recieved ?? 1
              });

            payload.results = results.sort((a, b)=> b.weight - a.weight);

            election_results.push( payload )

        }

        return election_results;
    }

   
}