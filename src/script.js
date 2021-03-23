const { exit } = require("process")

const fs = require("fs");
const path = require("path");
const puppeteer = require('puppeteer');

const { 
    isFileOnS3,
    uploadData,
    uploadFile,
    downloadFile,
    deleteFile
} = require('./s3')
const { getHomes, getHomeData } = require('./curl');
const { exception } = require("console");

const window_height = 768;
const window_width = 1366;

const AREA_SLUGS = {
    'Seattle': 'greater-seattle',
    'San Francisco': 'bay-area',
    'Dallas': 'dallas-ft-worth',
    'Austin': 'greater-austin',
    'Phoenix': 'greater-phoenix',
    'San Antonio': 'greater-san-antonio',
    'Houston': 'greater-houston',
    'Charlotte': 'greater-charlotte',
}

const get_home_url = (home) => {
  let url_address = `${home['street'] || ""}-${home['city']}-${home['state']}-${home.zipcode}`

  url_address = url_address.replace(/[^0-9a-zA-Z]+/g, '-')
  url_address = url_address.replace(/\s+/g, '-')

  const url = `https://zerodown.com/search/details/${url_address}/${home['homeId']}`
  return url
}

const studio_url = "https://studio.youtube.com/";

// directory contains the videos you want to upload
const upload_file_directory = path.join(__dirname, "../data/inputs/");
// change user data directory to your directory
const chrome_user_data_directory = "./chrome_user_data_dir";

const DEFAULT_ARGS = [
    '--disable-background-networking',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    // BlinkGenPropertyTrees disabled due to crbug.com/937609
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--force-color-profile=srgb',
    '--metrics-recording-only',
    '--no-first-run',
    '--enable-automation',
    '--password-store=basic',
    '--use-mock-keychain',
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createDataDirs() {
    if(!fs.existsSync(path.join(__dirname, "../data"))) {
        fs.mkdirSync(path.join(__dirname, "../data"), true); 
    }
    if(!fs.existsSync(path.join(__dirname, "../data/inputs"))) {
        fs.mkdirSync(path.join(__dirname, "../data/inputs"), true); 
    }
}

function currencyFormatter() {
    // Create our number formatter.
    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    
        // These options are needed to round to whole numbers if that's what you want.
        minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
        maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
    });
    return formatter;
}

function getHomeType(homeType) {
    if(homeType === undefined || homeType === null) {
        return 'Home'
    } else if(homeType === 'single-family') {
        return 'Single-family Home'
    } else {
        return homeType.replace(/^./, str => str.toUpperCase())
    }
}

async function runScript() {

    const getInputFilePath = (home_id) => `homevideos.prime/moviepy/outputs/1920x1080/${home_id}.mp4`
    const getInputShortsFilePath = (home_id) => `homevideos.prime/moviepy/outputs/1080x1920/${home_id}.mp4`
    const getLockFilePath = (home_id) => `homevideos.prime/youtube.uploader/lockfiles/${home_id}`
    const getErrorFilePath = (home_id) => `homevideos.prime/youtube.uploader/errorfiles/${home_id}`
    const getPostedFilePath = (home_id) => `homevideos.prime/youtube.uploader/posted/${home_id}`
    const getPostedShortsFilePath = (home_id) => `homevideos.prime/youtube.uploader/posted.shorts/${home_id}`

    const usdFormatter = currencyFormatter()

    const channel_name = process.env.CHANNEL
    const county = process.env.COUNTY
    const nhood = process.env.NHOOD
    const city = process.env.CITY
    const state = process.env.STATE
    if(channel_name === undefined) {
        console.log(`-- ERR - [PPTR]: CHANNEL must be provided as an env variable`)
        exit(1)
    }
    if(nhood) {
        if(city === undefined || state === undefined) {
            console.log(`-- ERR - [PPTR]: CITY and STATE must be provided as env variables if NHOOD is not defined.`)
            exit(1)
        }
    } else if(county === undefined  || city == undefined) {
        console.log(`-- ERR - [PPTR]: COUNTY or CITY must be provided as env variables if NHOOD is not defined.`)
        exit(1)
    }
    const params = {nhood, county, city, state}
    const homes = await getHomes(params)
    console.log(`-- INFO - [CURL]: num homes = ${homes.length}`)

    // sample data
    // [{
    //     id: '3639951',
    //     homeId: 3639951,
    //     status: 'FOR_SALE',
    //     homeType: 'condo',
    //     street: '320 Park View Terrace #203',
    //     city: 'Oakland',
    //     state: 'CA',
    //     zipcode: '94610',
    //     listingPrice: 468000,
    //     notes: "Picture yourself in one of Lake Merritt's Jewels... Your 1 bedroom plus BONUS room, possible 2nd bedroom/office/hobby room/playroom/den.  Nestled steps away from Lake Merritt, food and entertainment, and minutes from the freeway and mass transit.  Walk into an open concept kitchen and dining, with living space.  Bonus room has large sliding glass doors which open to your own private balcony.  New wood floors throughout. Kitchen and bathroom are updated with new counters.  The building offers secured parking with storage space,  onsite laundry facilities, elevator access, garbage chute."
    // }, ...]

    try {
        createDataDirs();
        (async () => {
            const browser = await puppeteer.launch(
                {
                    'headless': false,    // have window
                    executablePath: process.env.CHROME_PATH || '/Applications/Chromium.app/Contents/MacOS/Chromium',
                    userDataDir: chrome_user_data_directory,
                    ignoreDefaultArgs: DEFAULT_ARGS,
                    autoClose: false,
                    args: ['--lang=en-US,en',
                        `--window-size=${window_width},${window_height}`,
                        '--enable-audio-service-sandbox',
                        '--no-sandbox',
                    ],
                }
            );
            let page = await browser.newPage();
            await page.setViewport({'width': window_width, 'height': window_height});
            await page.goto(studio_url, options = {'timeout': 20 * 1000});

            await sleep(1_000 + Math.random() * 2_000);
            const url = page.url()
            if(url.match(/accounts\.google\.com/)) {
                console.log(`-- INFO - [CURL]: Login page. Waiting for 30 odd seconds`)
                // wait 30 seconds to enter username and password
                await sleep(30_000 + Math.random() * 2_000);
            }

            // click account button
            await sleep(3_000 + Math.random() * 2_000);
            await page.click('#avatar-btn')
            await sleep(2_000 + Math.random() * 2_000);
            // click "select account button"
            await page.click('yt-multi-page-menu-section-renderer > #items > .style-scope.yt-multi-page-menu-section-renderer:nth-child(3)')
            // pick the account for the county we need
            console.log(`-- INFO - [PPTR]: picking button with value ${channel_name}`)
            // const buttons = page.$x(`//yt-formatted-string#channel-title`)
            // const buttons = await page.$x(`//yt-formatted-string[@id="channel-title"][contains(text(),"${studio_names[county]}")]`)
            // if (buttons && buttons.length > 0) {
            //     if(buttons.length == 2) {
            //         await button[0].click();
            //     }
            //     if(buttons.length > 2) {
            //         await button[1].click();
            //     }
            // } else {
            //     console.log('!! studio not selected')
            //     await sleep(30_000 + Math.random() * 2_000);
            // }
            // await page.evaluate((channel_name) => {
            //     // $x(`//yt-formatted-string[@id="channel-title"][contains(text(),"Alameda CA Real Estate & Homes For Sale")]`)[0].click()
            //     $x(`//yt-formatted-string[@id="channel-title"][contains(text(),"${channel_name}")]`)[0].click()
            // }, studio_names[county])
            // const buttons = await page.$x(`//yt-formatted-string[contains(., '${channel_name}')]`);
            // console.log('\n---buttons')
            // console.log(buttons)
            // if (buttons && buttons.length > 0) {
            //     await buttons[0].click();
            // } else {
            //     throw new Error(`\n-- ERROR: xpath: page.$x("//yt-formatted-string[contains(., '${channel_name}')]") not found!`)
            // }
            // const linkHandlers = await page.$x(`//yt-formatted-string[contains(text(), '${channel_name}')]`);
            // console.log('\n---linkHandlers')
            // console.log(linkHandlers)
            // if (linkHandlers.length > 0) {
            //     await linkHandlers[0].click();
            // } else {
            //     throw new Error("Link not found");
            // }
            await sleep(2_000 + Math.random() * 2_000);
            const channel_clicked = await page.evaluate((channel_name) => {
                const elements = document.querySelectorAll('yt-formatted-string#channel-title')
                // console.log('\n---elements');
                // console.log(elements);
                const matchedElement = [...document.querySelectorAll('yt-formatted-string#channel-title')].find(element => element.textContent === channel_name)
                // console.log('\n---matchedElement for ' + channel_name);
                // console.log(matchedElement);
                if(matchedElement) {
                    matchedElement.click();
                    return true;
                }
                return false
            }, channel_name);
            console.log(`-- INFO - [PPTR]: channel_clicked`);
            console.log(channel_clicked);
            if(!channel_clicked) {
                throw new Error(`Could not change channel account to ${channel_name}`);
            }
            try {
                await sleep(3_000 + Math.random() * 2_000);
                page.evaluate(() => document.querySelector('iron-overlay-backdrop').click())
                console.log('-- INFO - [PPTR]: intro modal dismissed')
            } catch (e) {
                console.log('-- INFO - [PPTR]: intro modal not found')
            }

            for(const home of homes) {
                const home_id = home.homeId
                console.log(`\n---- starting for home_id: ${home_id} ----`)
                const video_title = `${usdFormatter.format(home.listingPrice)} ${getHomeType(home.homeType)} for sale in ${home.city} - ${home.street}`;
                const video_description = `
${(home.notes || '').replace('<', '').replace('>', '')}

LISTING LINK:
${get_home_url(home)}

BROWSE HOMES: 
https://zerodown.com/

FOLLOW US:
Instagram: https://www.instagram.com/zerodowndot
TikTok: https://www.tiktok.com/@zerodown_
Twitter: https://twitter.com/zerodownhq
Facebook: https://www.facebook.com/zerodownhq


${AREA_SLUGS[home['city']] !== undefined ? "For more homes in "+home['city']+", visit https://zerodown.com/"+AREA_SLUGS[home['city']] : ""}
                `;
            
                const input_file = getInputFilePath(home_id)
                const lock_file = getLockFilePath(home_id)
                const error_file = getErrorFilePath(home_id)
                const posted_file = getPostedFilePath(home_id)
                if(!(await isFileOnS3(input_file))) {
                    console.log(`-- Inputfile: ${input_file} does not exist. Skipping`)
                    continue
                }
                if(await isFileOnS3(posted_file)) {
                    console.log(`-- Video already posted: ${posted_file} exists. Skipping`)
                    continue
                }
                if(await isFileOnS3(lock_file)) {
                    console.log(`-- Lockfile: ${lock_file} exists. Skipping`)
                    continue
                }
                if(await isFileOnS3(error_file)) {
                    console.log(`-- Errofile: ${error_file} exists. Skipping`)
                    continue
                }
                await downloadFile(input_file, `data/inputs/${home_id}.mp4`)
                
                console.log(`-- uploading lockfile ${lock_file}`)
                await uploadData(home_id, lock_file)

                const file_name = `${home_id}.mp4`;
                console.log("-- now process file:\t" + file_name);

                //click create icon
                await sleep(4_000 + Math.random() * 2_000);
                await page.click('#create-icon');

                //click upload video
                await page.click('#text-item-0 > ytcp-ve');
                await sleep(3_000 + Math.random() * 2_000);
                //click select files button and upload file
                const [fileChooser] = await Promise.all([
                    page.waitForFileChooser({timeout: 60000}),
                    page.click('#select-files-button > div'), // some button that triggers file selection
                ]);
                await fileChooser.accept([upload_file_directory + file_name]);

                // wait for upload
                await sleep(12_000 + Math.random() * 3_000);

                // title content
                const text_box = await page.$x("//*[@id=\"textbox\"]");
                // clear existing text
                await text_box[0].click({ clickCount: 3 })
                // type title
                await text_box[0].type(video_title);
                await sleep(3_000 + Math.random() * 2_000);

                // Description content
                // await text_box[1].type(video_description); // old way. takes too long to type large text
                await page.evaluate((value) =>{ 
                    document.querySelectorAll('#textbox')[1].innerText = value
                }, video_description)
                // enter some text to register the new description value
                await text_box[1].type(' ')

                await sleep(3_000 + Math.random() * 2_000);
                const FOR_KIDS_RADIO_WRAPPER = '#made-for-kids-group > tp-yt-paper-radio-button:nth-child(2)'
                await page.click(FOR_KIDS_RADIO_WRAPPER);

                // add video to the second playlists
                // await page.click('#basics > ytcp-video-metadata-playlists > ytcp-text-dropdown-trigger > ytcp-dropdown-trigger > div');
                // await page.click('#items > ytcp-ve:nth-child(3)');
                // await page.click('#dialog > div.action-buttons.style-scope.ytcp-playlist-dialog > ytcp-button.save-button.action-button.style-scope.ytcp-playlist-dialog > div');
                // await sleep(500);

                //click next
                await sleep(2_000 + Math.random() * 2_000);
                await page.click('#dialog > div > ytcp-animatable.button-area.metadata-fade-in-section.style-scope.ytcp-uploads-dialog > div > div.right-button-area.style-scope.ytcp-uploads-dialog');
                //click next
                await sleep(2_000 + Math.random() * 2_000);
                await page.click('#dialog > div > ytcp-animatable.button-area.metadata-fade-in-section.style-scope.ytcp-uploads-dialog > div > div.right-button-area.style-scope.ytcp-uploads-dialog');
                // optional next button for copyright
                try {
                    //click next
                    await sleep(2_000 + Math.random() * 2_000);
                    await page.click('#dialog > div > ytcp-animatable.button-area.metadata-fade-in-section.style-scope.ytcp-uploads-dialog > div > div.right-button-area.style-scope.ytcp-uploads-dialog');
                } catch(e) {
                    console.log(e)
                }
                //click publish now and public
                await sleep(2_000 + Math.random() * 2_000);
                await page.click('#first-container');
                // await page.click('#privacy-radios > paper-radio-button:nth-child(1)');
                await sleep(2_000 + Math.random() * 2_000);
                await page.evaluate(() => {
                    document.querySelectorAll('#privacy-radios > tp-yt-paper-radio-button')[2].click()
                })
                await sleep(1_000 + Math.random() * 2_000);

                const youtube_url = await page.evaluate(() => {
                    return document.querySelector('.video-url-fadeable > a').href
                })
                console.log(`--- youtube_url = ${youtube_url}`)
                // upload posted file
                await uploadData(youtube_url, getPostedFilePath(home_id))
                await sleep(5_000);
                
                await page.click('#done-button');
                await sleep(5_000 + Math.random() * 2_000);
                // close
                await page.click('#close-button > div');
                
                // ---- cleanup ----
                // delete the input file to save disk space
                fs.unlinkSync(`data/inputs/${home_id}.mp4`)
                // console.log(`-- deleting lock file ${lock_file}`)
                await deleteFile(lock_file)
                console.log(`-- done`)
                // wait for some time before next upload
                await sleep(10_000 + Math.random() * 5);
            }

            await browser.close();
        })();

    } catch (error) {
        console.log(error);
        deleteFile(lock_file)
    }
}

module.exports = {
    runScript
}
