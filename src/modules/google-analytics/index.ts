import { Module } from "@medusajs/framework/utils"
import { GoogleAnalytics } from "../../transport"

export default Module("googleAnalytics", { service: GoogleAnalytics })
