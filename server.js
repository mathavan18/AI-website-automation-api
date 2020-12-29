import express from "express";
import cors from "cors";
import multer from "multer";
import vision from "@google-cloud/vision";
import fs from "fs";

const app = express();
const port = process.env.PORT || 8001;
app.use(express.json());
app.use(cors());

let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + getExtension(file.mimetype));
  },
});

let upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.status(200).send("backend");
});

const getExtension = (mimeType) => {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpeg";
    case "image/png":
      return ".png";
  }
};

app.post("/api/upload", upload.single("image_file"), (req, res) => {
  let fileUrl = req.file.path.replace(/\\/g, "/");
  let result = getInfoFromGoogleVisionApi(`./${fileUrl}`);

  result
    .then((value) => {
      res.status(200).send(value);
    })
    .catch((err) => {
      res.status(500).send("Cannot connect to Google Vision API");
    });
});

app.listen(port, () => console.log(`Listening on ${port}`));

async function getInfoFromGoogleVisionApi(filePath) {
  // Creates a client
  const client = new vision.ImageAnnotatorClient();

  let visionApiResult = {
    colors: null,
    text: null,
    logos: null,
    document: null,
  };

  // Performs label detection on the image file
  // const [result] = await client.labelDetection(filePath);
  // const labels = result.labelAnnotations;
  // console.log("Labels:");
  // labels.forEach((label) => console.log(label.description));

  // Performs property detection on the local file
  const [result1] = await client.imageProperties(filePath);
  const colors = result1.imagePropertiesAnnotation.dominantColors.colors;
  visionApiResult["colors"] = colors;

  // Performs logo detection on the local file
  const [result2] = await client.logoDetection(filePath);
  const logos = result2.logoAnnotations;
  visionApiResult["logos"] = logos;

  // Performs text detection on the local file
  const [result3] = await client.textDetection(filePath);
  const detections = result3.textAnnotations;
  visionApiResult["text"] = detections;
  createHtmlPage(detections);

  // Performs text detection on the local file
  const [result4] = await client.documentTextDetection(filePath);
  const documentTextdetections = result4.fullTextAnnotation;
  visionApiResult["document"] = documentTextdetections;

  removeFile();
  return visionApiResult;
}

function removeFile() {
  let path = "./uploads/";
  fs.readdir(path, (err, files) => {
    if (err) {
      console.log(err);
    }
    for (const file of files) {
      fs.unlink(path.concat(file), (err) => {
        if (err) {
          console.log(err);
        }
      });
    }
  });
}

const createHtmlPage = (detections) => {
  let htmlContent = "";
  detections.map((element) => {
    let coord = [];

    element.boundingPoly.vertices.map((index) => {
      coord.push({ x: index.x, y: index.y });
    });

    let stringCoord = `${coord[0].x},${coord[0].y} ${coord[1].x},${coord[1].y} ${coord[2].x},${coord[2].y} ${coord[3].x},${coord[3].y}`;
    console.log(stringCoord);

    htmlContent += `
            <svg>
              <polygon
                points=${stringCoord}
                style={{ fill: "lime", stroke: "purple", strokeWidth: "1" }}
              />
              Sorry, your browser does not support inline SVG.
            </svg>
          `;
  });

  console.log("html=" + htmlContent);
  fs.appendFile("./views/test.html", htmlContent, function (err) {
    if (err) throw err;
    console.log("Saved!");
  });
};
