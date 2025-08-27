const mongoose = require('mongoose')

const mancomSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
      },
      mancom: {
        type: String, // Январь, Февраль и т.д.
        required: true,
        enum: [
          "Компания 1",
          "Компания 2"
        ],
    },
    amount: {
      type: Number, // начисление
      default: 0
    }  
})

module.exports = mongoose.model("Mancom", mancomSchema);