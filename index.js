require('dotenv').config();
const fs = require('fs');
const ytdl = require('ytdl-core');
const ftp = require('basic-ftp');
const nodemailer = require('nodemailer');

/**
 * Random id with the Date
 */
function getVideoId() {
    let newDate = new Date();
    return 'video_' + parseInt(newDate.getMonth() + 1) + '-' + newDate.getDate() + '-' + newDate.getFullYear() + '-' + newDate.getTime() + '.mp4';
}

/**
 * Download the video from Youtube
 */
function downloadVideo() {
    console.log(`Starting download - ${new Date()}`);

    let promise = new Promise(function (resolve, reject) {
        let videoName = getVideoId();
        let writeStream = fs.createWriteStream(videoName);

        ytdl(process.env.YOUTUBE_VIDEO).pipe(writeStream);

        writeStream.on('finish', () => resolve(videoName));
        writeStream.on('error', () => reject());
        setTimeout( () => { 
            console.log(`After ${process.env.LENGTH} min, let's stop`);
            writeStream.end(); 
            const {size} = fs.statSync(videoName);
            console.log(`Size ${size}`);
        }, process.env.LENGTH * 1000 * 60);
    });

    return promise;
}

/**
 * Upload to FTP
 */
async function uploadToFTP(videoName) {
    const client = new ftp.Client();
    //client.ftp.verbose = true;
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD
        });
        await client.ensureDir(process.env.FOLDER);
        await client.clearWorkingDir();
        await client.uploadFrom(videoName, videoName);
    } catch (err) {
        console.log(err);
    }
    client.close();
}

/**
 * Send email
 */
async function sendEmail(videoName) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO, // list of receivers
        subject: 'Youtube - download', // Subject line
        html: `ftp://${process.env.FTP_USER}:${process.env.FTP_PASSWORD}@${process.env.FTP_HOST}/${process.env.FOLDER}/${videoName}`
    });

    console.log('Message sent: %s', info.messageId);
}

async function main() {
    try {
        downloadVideo().then(async (videoName) => {
            await uploadToFTP(videoName);
            await sendEmail(videoName);
            fs.unlinkSync(videoName);
            process.exit(0);
        });
    }
    catch(err) {
        console.log(err);
    }
}

main().catch(console.log);
