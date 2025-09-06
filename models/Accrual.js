// models/Accrual.js
const mongoose = require("mongoose");

const accrualSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId, // ссылка на договор
      ref: "Contract",
      required: true,
    },
    date: { type: Date, required: true },
    contractAmount: { type: Number, required: true },
    accrualAmount: {
      type: Number, // начисление
      required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Accrual", accrualSchema);