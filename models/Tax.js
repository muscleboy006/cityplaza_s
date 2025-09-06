const mongoose = require('mongoose')

const taxSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true,
      },
    totalTax: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number, // начисление
      default: 0
    },
    paymentAmount: [
      {
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
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

taxSchema.index({ year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Tax", taxSchema);