const mongoose = require("mongoose");
const doubtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    question: {
      type: String,
      required: true,
      trim: true
    },

    answer: {
      type: String,
      required: true
    },

    source: {
      type: String,
      enum: ["gemini", "history"],
      default: "gemini"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Doubt", doubtSchema);