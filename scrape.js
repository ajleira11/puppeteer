const puppeteer = require("puppeteer");
const { Storage } = require("@google-cloud/storage");

async function initBrowser() {
  console.log("Initializing browser");
  return await puppeteer.launch();
}

async function takeData(browser, url) {
  const page = await browser.newPage();

  console.log(`Navigating to ${url}`);
  await page.goto(url);

  await page.waitForSelector(".posting");

  //capture the Company Name fromm the page title
  const companyName = await page.$eval(
    'meta[name="twitter:title"]',
    (element) => element.getAttribute("content")
  );

  console.log("Company Name:", companyName);

  const jobs = await page.$$eval(
    ".postings-group .posting",
    (postings, companyName) =>
      postings.map((posting) => {
        const areasElement = posting
          .closest(".postings-group")
          .querySelector(".large-category-label");
        const areas = areasElement ? areasElement.innerText : "";
        const workTypeElement = posting.querySelector(
          ".posting-categories .sort-by-commitment"
        );
        const workType = workTypeElement ? workTypeElement.innerText : "";

        const titleElement = posting.querySelector(
          ".posting-title h5[data-qa='posting-name']"
        );
        const locationElement = posting.querySelector(
          ".posting-title .posting-categories .sort-by-location"
        );
        const workStyleElement = posting.querySelector(
          ".posting-categories .workplaceTypes"
        );
        const jobURLElement = posting.querySelector(".posting .posting-title");

        return {
          companyName: companyName,
          areas: areas,
          title: titleElement ? titleElement.innerText : "",
          location: locationElement ? locationElement.innerText : "",
          workStyle: workStyleElement ? workStyleElement.innerText : "",
          workType: workType,
          jobURL: jobURLElement ? jobURLElement.href : "",
        };
      }),
    companyName
  );
  //open job links and add the description inside the jobs list
  const updatedJobs = await addDescription(jobs, browser);

  return updatedJobs;
}

async function addDescription(jobs, browser) {
  for (const job of jobs) {
    const jobLandingPage = await browser.newPage();
    await jobLandingPage.goto(job.jobURL);
    await jobLandingPage.waitForSelector('meta[property="og:description"]');
    job.description = await jobLandingPage.$eval(
      'meta[property="og:description"]', // Selector for the meta tag containing the description
      (element) => (element ? element.getAttribute("content") : "")
    );
    await jobLandingPage.close();
  }
  return jobs;
}

async function createStorageBucketIfMissing(storage, bucketName) {
  console.log(
    `Checking for Cloud Storage bucket '${bucketName}' and creating if not found`
  );
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (exists) {
    // Bucket exists, nothing to do here
    return bucket;
  }

  // Create bucket
  const [createdBucket] = await storage.createBucket(bucketName);
  console.log(`Created Cloud Storage bucket '${createdBucket.name}'`);
  return createdBucket;
}

async function uploadImage(bucket, taskIndex, jobsData) {
  // Create filename using the current time and task index
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  const filename = `${date.toISOString()}-${
    jobsData.companyName
  }-task${taskIndex}`;

  console.log(`Uploading screenshot as '${filename}'`);
  await bucket.file(filename).save(jobsData);

  const jsonData = {
    companyName: jobsData.companyName,
    jobs: jobsData.jobs.map((job) => ({
      title: job.title,
      location: job.location,
      workStyle: job.workStyle,
      workType: job.workType,
      url: job.jobURL,
      areas: job.areas,
      description: job.description,
    })),
  };
  console.log(`Uploading data as '${filename}.json'`);
  await bucket.file(`${filename}.json`).save(JSON.stringify(jsonData));
}

async function main(urls) {
  console.log(`Passed in urls: ${urls}`);

  const taskIndex = process.env.CLOUD_RUN_TASK_INDEX || 0;
  const url = urls[taskIndex];
  if (!url) {
    throw new Error(
      `No url found for task ${taskIndex}. Ensure at least ${
        parseInt(taskIndex, 10) + 1
      } url(s) have been specified as command args.`
    );
  }
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error(
      "No bucket name specified. Set the BUCKET_NAME env var to specify which Cloud Storage bucket the screenshot will be uploaded to."
    );
  }

  const browser = await initBrowser();
  const jobsData = await takeData(browser, url).catch(async (err) => {
    // Make sure to close the browser if we hit an error.
    await browser.close();
    throw err;
  });
  await browser.close();

  console.log("Initializing Cloud Storage client");
  const storage = new Storage();
  const bucket = await createStorageBucketIfMissing(storage, bucketName);
  await uploadImage(bucket, taskIndex, jobsData);

  console.log("Upload complete!");
}

main(process.argv.slice(2)).catch((err) => {
  console.error(JSON.stringify({ severity: "ERROR", message: err.message }));
  process.exit(1);
});
