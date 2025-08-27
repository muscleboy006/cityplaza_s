const mongoose = require('mongoose')

const electrcySchema = new mongoose.Schema({
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
    totalElectrcy: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number, // начисление
      default: 0
    },
    differ: {
      type: Number,
      default: 0
    },
    inPercent: {
      type: Number,
      default: 0
    },
    paymentAmount: [
      {
        contractId: {
          type: mongoose.Schema.Types.ObjectId, // ссылка на договор
          ref: "Contract",
        },
        name: {
          type: String
        },
        amount: {
          type: Number,
          required: true,
        },
        images: [
          {
            type: String, // URL или путь к изображению
          },
        ],
      },
    ],
})

electrcySchema.index({ year: 1, month: 1, contractId: 1 }, { unique: true });

module.exports = mongoose.model("Electrcy", electrcySchema);