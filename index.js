//This version will run locally and save a .json file and .png image
//use node workable.js
const fs = require("fs");
const { join } = require("path");
const puppeteer = require("puppeteer");

async function run() {
  try {
    const leverURL = "https://www.lever.co/";
    const inputURL = "https://jobs.lever.co/health-match/";
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    console.log("Launching browser...");

    await page.goto(inputURL);
    console.log("Navigating to:", inputURL);

    // Wait for the job listings to load to ensure data exists
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
          const jobURLElement = posting.querySelector(
            ".posting .posting-title"
          );

          return {
            companyName: companyName,
            areas: areas,
            title: titleElement ? titleElement.innerText : "",
            location: locationElement ? locationElement.innerText : "",
            workStyle: [workStyleElement],
            workType: [workType],
            jobURL: jobURLElement ? jobURLElement.href : "",
          };
        }),
      companyName
    );
    jobs.map((job) => {
      console.log(job.workStyle);
    });
    const updatedJobs = await addDescription(jobs, browser);

    const output = await formatOutput(updatedJobs);
    //open job links and add the description inside the jobs list
    console.log("Jobs:", output);

    await browser.close();
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function addDescription(jobs, browser) {
  try {
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

    const jsonData = jobs.map((job, index) => ({
      companyName: job.companyName,
      createdAt: "",
      status: "",
      companyId: "",
      applyLink: job.jobURL,
      title: job.title,
      workStyle: job.workStyle,
      workType: job.workType,
      seniority: "",
      location: [job.location],
      timing: "",
      areas: [job.areas],
      images: "",
      video: "",
      audio: "",
      description: job.description,
      questions: {
        problems: "",
        traits: "",
        whyNow: "",
      },
      hiringManagerIds: "",
    }));

    return jsonData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function formatOutput(jobs) {
  for (let job of jobs) {
    job.workStyle = job.workStyle.flatMap((style) => {
      if (!style) {
        return job.workStyle;
      }
      //convert style to single array each word,
      const separateStyleArray = style
        .toString()
        .split(/\s+|(?<!\w)(?=\W)|(?<=\W)(?!\w)/);

      const finalStyle = separateStyleArray
        .map((style) => {
          const formatStyle =
            style.charAt(0).toUpperCase() + style.slice(1).toLowerCase();
          return formatStyle;
        })
        .filter((style) => style.length > 1); //filter out each element in an array where

      return finalStyle;
    });

    //----------------------------------------------------------------

    job.workType = await job.workType.flatMap((type) => {
      if (!type) {
        const filterType = type.filter(Boolean);
        console.log(filterType);
        return filterType;
      }
      const separateTypeArray = type.toString().split(" ");

      const finalType = separateTypeArray
        .map((type) => {
          const formatType =
            type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
          if (formatType === "Full") {
            return "Full-time";
          } else if (formatType === "Part") {
            return "Part-time";
          } else {
            return formatType;
          }
        })
        .filter(
          (type) => type.length > 1 && type !== "Time" && type !== "Term"
        ); // Filter out elements with length <= 1 and also remove type

      return finalType;
    });

    job.location = await capitalizeWords(job.location);
    job.areas = await capitalizeWords(job.areas);
  }

  return jobs;
}

async function capitalizeWords(str) {
  // if (str.length <= 1) {
  //   return [""];
  // }
  // Convert the string to lowercase and split it into words
  const words = str[0].toLowerCase();
  if (words.length <= 1) {
    return [""];
  }

  const newWords = words.split(" ");

  // Capitalize the first letter of each word
  const capitalizedWords = newWords.map((word) => {
    // Capitalize the first letter of the word and concatenate it with the rest of the word
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  // Join the capitalized words back into a single string
  const toArray = capitalizedWords.join(" ");
  return [toArray];
}

run();
