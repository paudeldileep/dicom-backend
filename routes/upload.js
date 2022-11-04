let express = require("express"),
  multer = require("multer"),
  router = express.Router();

const { v4: uuidv4 } = require("uuid");
const DIR = "./public/";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DIR);
  },
  filename: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase().split(" ").join("-");
    cb(null, uuidv4() + "-" + fileName);
  },
});
var upload = multer({
  storage: storage,
});

router.post("/upload", upload.array("images", 5), (req, res, next) => {
  const reqFiles = [];
  const url = req.protocol + "://" + req.get("host");
  for (var i = 0; i < req.files.length; i++) {
    reqFiles.push(url + "/public/" + req.files[i].filename);
  }

  res.status(201).json({
    message: "Done upload!",
    images: [...reqFiles],
  });
});

router.get("/upload", (req, res) => {
  res.json({
    message: "Okay",
  });
});

module.exports = router;
