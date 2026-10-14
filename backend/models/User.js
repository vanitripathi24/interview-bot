const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String }, // hashed, absent for guests
    role: { type: String, enum: ["candidate", "admin"], default: "candidate" },
    isGuest: { type: Boolean, default: false },
    // Biometric fields — see faceRoutes.js. We store ONLY a 1024-length numeric
    // face embedding (a mathematical "signature" produced by @vladmandic/human's
    // recognition model), never the actual photo/image. This embedding cannot
    // be reversed back into a picture of the person's face.
    faceDescriptor: { type: [Number], default: undefined, select: false },
    faceConsentGiven: { type: Boolean, default: false },
    faceConsentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
