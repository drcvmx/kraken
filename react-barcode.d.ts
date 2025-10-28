declare module "react-barcode" {
  import { Component } from "react";

  interface BarcodeProps {
    value: string;
    format?:
      | "CODE128"
      | "CODE128A"
      | "CODE128B"
      | "CODE128C"
      | "EAN13"
      | "EAN8"
      | "EAN5"
      | "EAN2"
      | "UPC"
      | "CODE39"
      | "ITF14"
      | "MSI"
      | "MSI10"
      | "MSI11"
      | "MSI1010"
      | "MSI1110"
      | "pharmacode"
      | "codabar";
    width?: number;
    height?: number;
    displayValue?: boolean;
    text?: string;
    fontOptions?: string;
    font?: string;
    textAlign?: string;
    textPosition?: string;
    textMargin?: number;
    fontSize?: number;
    background?: string;
    lineColor?: string;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    flat?: boolean;
    ean128?: boolean;
    renderer?: "svg" | "canvas" | "img";
  }

  export default class Barcode extends Component<BarcodeProps> {}
}
