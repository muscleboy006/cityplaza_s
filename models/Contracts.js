// models/OfficeContract.js
const mongoose = require('mongoose');

const officeContractSchema = new mongoose.Schema({
  floor: { type: Number, required: true }, // Этаж
  area: { type: String, required: true }, // Квадратура (например, "24 м²")
  officeNumber: { type: String, required: true }, // Кабинет
  company: { type: String, required: true }, // Компания
  moveInDate: { type: Date, required: true }, // Дата въезда
  moveOutDate: { type: Date }, // Дата выезда
  contractAmount: { type: Number, required: true }, // Сумма по договору
  contractAmountMinus12: { type: Number, required: true }, // Сумма (-12%)
}, {
  timestamps: true // createdAt, updatedAt
});

module.exports = mongoose.model('OfficeContract', officeContractSchema);