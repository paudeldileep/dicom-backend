// *************for conversion****************
//import * as fs from "fs";
const fs = require("fs");
//import * as crypto from "crypto";
//import * as path from "path";
const path = require("path");
//import * as dicomParser from "dicom-parser"; //DICOM resolution
const dicomParser = require("dicom-parser");

//import * as canvas from "canvas";
const canvas = require("canvas");

// import imagemin from "imagemin";
// import imageminJpegtran from "imagemin-jpegtran";
// import imageminPngquant from "imagemin-pngquant";

const imagemin = require("imagemin");
const imageminJpegtran = require("imagemin-jpegtran");
const imageminPngquant = require("imagemin-pngquant");

//const getVOILUT = async () => {};

const saveMinImage = async (jpegFilePath) => {
  let newPath = jpegFilePath;
  jpegFilePath = jpegFilePath.replace(/\\/g, "/");
  imagemin([jpegFilePath], {
    destination: newPath,
    plugins: [
      imageminJpegtran(),
      imageminPngquant({
        speed: 11,
        quality: [0.1, 0.1], //Compression quality (0,1)
      }),
    ],
  })
    .then(() => {
      console.log("Compression succeeded====", jpegFilePath);
    })
    .catch((err) => {
      console.log("Compression failed:" + err);
    });
};

const getLut = (data, windowWidth, windowCenter, invert, voiLUT) => {
  let minPixelValue = 0;
  let maxPixelValue = 0;
  for (let i = 0, len = data.length; i < len; i++) {
    if (minPixelValue > data[i]) {
      minPixelValue = data[i];
    }
    if (maxPixelValue < data[i]) {
      maxPixelValue = data[i];
    }
  }
  let offset = Math.min(minPixelValue, 0);
  let lutArray = new Uint8ClampedArray(maxPixelValue - offset + 1);
  const vlutfn = getVOILUT(windowWidth, windowCenter, voiLUT, true);
  if (invert === true) {
    for (
      let storedValue = minPixelValue;
      storedValue <= maxPixelValue;
      storedValue++
    ) {
      lutArray[storedValue + -offset] = 255 - vlutfn(storedValue);
    }
  } else {
    for (
      let storedValue = minPixelValue;
      storedValue <= maxPixelValue;
      storedValue++
    ) {
      lutArray[storedValue + -offset] = vlutfn(storedValue);
    }
  }
  return {
    minPixelValue: minPixelValue,
    maxPixelValue: maxPixelValue,
    lutArray: lutArray,
  };
};

const createJpegAsync = async (cv, jpegFilePath) => {
  let stream;
  let u = cv.toDataURL();
  const Image = canvas.Image;
  const img = new Image();
  img.onload = async () => {
    let ca = canvas.createCanvas(img.width, img.height);
    let ctx = ca.getContext("2d");
    ctx.drawImage(img, 0, 0);
    stream = ca.createJPEGStream();
    //stream.pipe(fs.createWriteStream(filePath));
    try {
      fs.writeFileSync(jpegFilePath, stream.read());
    } catch (e) {
      console.log("e3", e);
    }

    await saveMinImage(jpegFilePath);
  };
  img.onerror = (err) => {
    throw err;
  };
  img.src = u;
};

const createPngAsync = async (
  cv,
  pngFilePath,
  pixelDataBuffer,
  w,
  h,
  windowWidth,
  windowCenter,
  invert,
  jpegFilePath
) => {
  let stream;
  let ctx = cv.getContext("2d", { pixelFormat: "A8" }); //Grayscale image
  let uint16 = new Uint16Array(
    pixelDataBuffer.buffer,
    pixelDataBuffer.byteOffset,
    pixelDataBuffer.byteLength / Uint16Array.BYTES_PER_ELEMENT
  ); //Get the pixel array of uint16
  let voiLUT;
  let lut = getLut(uint16, windowWidth, windowCenter, invert, voiLUT); //Get grayscale array
  let uint8 = new Uint8ClampedArray(uint16.length); //Eight bit grayscale pixel array
  //Replace the corresponding pixels with grayscale
  for (let i = 0, len = uint16.length; i < len; i++) {
    uint8[i] = lut.lutArray[uint16[i]];
  }
  let image = canvas.createImageData(uint8, w, h);
  ctx.putImageData(image, 0, 0);
  stream = cv.createPNGStream({
    compressionLevel: 9,
    filters: cv.PNG_FILTER_NONE,
  });
  //stream.pipe(fs.createWriteStream(filePath));

  try {
    fs.writeFileSync(pngFilePath, stream.read());
  } catch (e) {
    console.log("eee:", e);
  }
  this.saveMinImage(filePath);
  if (jpegFilePath) {
    //Generate JPG
    createJpegAsync(cv, jpegFilePath);
  }
};

const createImage = async (fileName, dataSet, tags, dicomFileAsBuffer) => {
  //const savePath = "../public/"; //Default storage root directory
  const savePath = __dirname;
  let pngFileName = fileName + ".png";
  let jpegFileName = fileName + ".jpg";
  //let nextDir = fileName.substring(0, 2) + "/" + fileName.substring(2, 4);
  let pngFilePath = path.join(savePath, "..", "public", pngFileName);

  var jpegFilePath = path.join(savePath, "..", "public", jpegFileName);

  let w = parseInt(tags["x00280011"]); //image width
  let h = parseInt(tags["x00280010"]); //Picture height
  let invert = tags["x00280004"] === "MONOCHROME1" ? true : false; //Whether the image is inverted
  let windowCenter = parseInt(tags["x00281050"]); //Window center
  let windowWidth = parseInt(tags["x00281051"]); //Window width

  let pixelData = dataSet.elements.x7fe00010;
  let pixelDataBuffer = dicomParser.sharedCopy(
    dicomFileAsBuffer,
    pixelData.dataOffset,
    pixelData.length
  );
  //Generate PNG
  let cv = canvas.createCanvas(w, h); //Create canvas
  createPngAsync(
    cv,
    pngFilePath,
    pixelDataBuffer,
    w,
    h,
    windowWidth,
    windowCenter,
    invert,
    jpegFilePath
  );
  //await createJpegAsync(cv, jpegFilePath);
};

exports.createImages = async (fileList) => {
  const destinationPath = __dirname;

  try {
    for (let i = 0, len = fileList.length; i < len; i++) {
      let fileName = fileList[i];
      let filePath = path.join(destinationPath, "..", "public", fileName);
      //read file
      let dicomFileAsBuffer = fs.readFileSync(filePath);
      let dataSet = dicomParser.parseDicom(dicomFileAsBuffer);
      let tags = dicomParser.explicitDataSetToJS(dataSet); //All tags

      //Generate PNG and JPG pictures
      await createImage(fileName, dataSet, tags, dicomFileAsBuffer);
    }
    return true;
  } catch (e) {
    console.log("e1:", e);
    return false;
  }
};
