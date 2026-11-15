import mongoose, { Schema } from "mongoose";
const sessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    refreshTokenHash: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.models.Session ||
    mongoose.model("Session", sessionSchema);
