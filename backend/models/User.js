const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String }, // hashed, absent for guests
    role: { type: String, enum: ["candidate", "admin"], default: "candidate" },
    isGuest: { type: Boolean, default: false },
    // Biometric fields — see faceRoutes.js. We store ONLY a 128-length numeric
    // face descriptor (a mathematical "signature" produced by face-api.js),
    // never the actual photo/image. This descriptor cannot be reversed back
    // into a picture of the person's face.
    faceDescriptor: { type: [Number], default: undefined, select: false },
    faceConsentGiven: { type: Boolean, default: false },
    faceConsentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
