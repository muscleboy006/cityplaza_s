// models/Accrual.js
const mongoose = require("mongoose");

const accrualSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId, // ссылка на договор
      ref: "Contract",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: String, // Январь, Февраль и т.д.
      required: true,
      enum: [
        "Январь",
        "Февраль",
        "Март",
        "Апрель",
        "Май",
        "Июнь",
        "Июль",
        "Август",
        "Сентябрь",
        "Октябрь",
        "Ноябрь",
        "Декабрь",
      ],
    },
    contractAmount: { type: Number, required: true },
    accrualAmount: {
      type: Number, // начисление
      required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Accrual", accrualSchema);