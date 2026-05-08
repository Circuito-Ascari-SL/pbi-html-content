"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;

interface HtmlContentSettings {
    backgroundColor: string;
    transparentBackground: boolean;
    padding: number;
    overflowMode: string;
    horizontalAlign: string;
    verticalAlign: string;
    scale: number;
    showEmptyMessage: boolean;
    sanitizeHtml: boolean;
    allowStyles: boolean;
    allowSvg: boolean;
    allowImages: boolean;
    allowLinks: boolean;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private root: HTMLDivElement;
    private content: HTMLDivElement;
    private settings: HtmlContentSettings;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;

        this.root = document.createElement("div");
        this.root.className = "htmlContentRoot";

        this.content = document.createElement("div");
        this.content.className = "htmlContentBody";

        this.root.appendChild(this.content);
        this.target.appendChild(this.root);

        this.settings = {
            backgroundColor: "#FFFFFF",
            transparentBackground: false,
            padding: 0,
            overflowMode: "auto",
            horizontalAlign: "left",
            verticalAlign: "flex-start",
            scale: 100,
            showEmptyMessage: true,
            sanitizeHtml: true,
            allowStyles: true,
            allowSvg: true,
            allowImages: true,
            allowLinks: true
        };
    }

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews.length > 0
            ? options.dataViews[0]
            : undefined;

        this.readSettings(dataView);
        this.applyLayout();

        const html = this.getHtmlValue(dataView);

        if (!html || html.trim().length === 0) {
            this.content.innerHTML = this.settings.showEmptyMessage
                ? "<div class=\"htmlContentEmpty\">Add a measure with HTML content</div>"
                : "";
            return;
        }

        this.content.innerHTML = this.settings.sanitizeHtml
            ? this.sanitizeHtml(html)
            : html;

        this.postProcessLinks();
    }

    private getHtmlValue(dataView?: DataView): string {
        if (!dataView || !dataView.categorical || !dataView.categorical.values || dataView.categorical.values.length === 0) {
            return "";
        }

        const values = dataView.categorical.values[0];

        if (!values || !values.values || values.values.length === 0) {
            return "";
        }

        for (let i = 0; i < values.values.length; i++) {
            const value = values.values[i];

            if (value !== null && value !== undefined && String(value).trim().length > 0) {
                return String(value);
            }
        }

        return "";
    }

    private applyLayout(): void {
        this.root.style.backgroundColor = this.settings.transparentBackground
            ? "transparent"
            : this.settings.backgroundColor;

        this.root.style.padding = this.safeNumber(this.settings.padding, 0, 200) + "px";
        this.root.style.overflow = this.settings.overflowMode;
        this.root.style.justifyContent = this.settings.verticalAlign;

        if (this.settings.horizontalAlign === "center") {
            this.root.style.alignItems = "center";
            this.content.style.textAlign = "center";
        } else if (this.settings.horizontalAlign === "right") {
            this.root.style.alignItems = "flex-end";
            this.content.style.textAlign = "right";
        } else {
            this.root.style.alignItems = "flex-start";
            this.content.style.textAlign = "left";
        }

        const scale = this.safeNumber(this.settings.scale, 10, 500) / 100;
        this.content.style.transform = "scale(" + scale + ")";
        this.content.style.transformOrigin = this.getTransformOrigin();
    }

    private getTransformOrigin(): string {
        const vertical = this.settings.verticalAlign === "center"
            ? "center"
            : this.settings.verticalAlign === "flex-end"
                ? "bottom"
                : "top";

        const horizontal = this.settings.horizontalAlign === "center"
            ? "center"
            : this.settings.horizontalAlign === "right"
                ? "right"
                : "left";

        return vertical + " " + horizontal;
    }

    private readSettings(dataView?: DataView): void {
        if (!dataView || !dataView.metadata || !dataView.metadata.objects) {
            return;
        }

        const objects = dataView.metadata.objects;

        if (objects["general"]) {
            const general = objects["general"];

            if (general["backgroundColor"] && general["backgroundColor"]["solid"]) {
                this.settings.backgroundColor = general["backgroundColor"]["solid"]["color"];
            }

            if (general["transparentBackground"] !== undefined) {
                this.settings.transparentBackground = general["transparentBackground"] as boolean;
            }

            if (general["padding"] !== undefined) {
                this.settings.padding = Number(general["padding"]);
            }

            if (general["overflowMode"] !== undefined) {
                this.settings.overflowMode = String(general["overflowMode"]);
            }
        }

        if (objects["content"]) {
            const content = objects["content"];

            if (content["horizontalAlign"] !== undefined) {
                this.settings.horizontalAlign = String(content["horizontalAlign"]);
            }

            if (content["verticalAlign"] !== undefined) {
                this.settings.verticalAlign = String(content["verticalAlign"]);
            }

            if (content["scale"] !== undefined) {
                this.settings.scale = Number(content["scale"]);
            }

            if (content["showEmptyMessage"] !== undefined) {
                this.settings.showEmptyMessage = content["showEmptyMessage"] as boolean;
            }
        }

        if (objects["security"]) {
            const security = objects["security"];

            if (security["sanitizeHtml"] !== undefined) {
                this.settings.sanitizeHtml = security["sanitizeHtml"] as boolean;
            }

            if (security["allowStyles"] !== undefined) {
                this.settings.allowStyles = security["allowStyles"] as boolean;
            }

            if (security["allowSvg"] !== undefined) {
                this.settings.allowSvg = security["allowSvg"] as boolean;
            }

            if (security["allowImages"] !== undefined) {
                this.settings.allowImages = security["allowImages"] as boolean;
            }

            if (security["allowLinks"] !== undefined) {
                this.settings.allowLinks = security["allowLinks"] as boolean;
            }
        }
    }

    private sanitizeHtml(html: string): string {
        const template = document.createElement("template");
        template.innerHTML = html;

        const blockedTags = [
            "script",
            "iframe",
            "object",
            "embed",
            "meta",
            "base",
            "form",
            "input",
            "button",
            "textarea",
            "select"
        ];

        if (!this.settings.allowStyles) {
            blockedTags.push("style");
        }

        if (!this.settings.allowSvg) {
            blockedTags.push("svg");
        }

        blockedTags.forEach(tagName => {
            const nodes = template.content.querySelectorAll(tagName);
            nodes.forEach(node => node.remove());
        });

        if (!this.settings.allowImages) {
            const images = template.content.querySelectorAll("img, picture, source");
            images.forEach(node => node.remove());
        }

        const allElements = template.content.querySelectorAll("*");

        allElements.forEach(element => {
            Array.from(element.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.toLowerCase().trim();

                if (name.startsWith("on")) {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (!this.settings.allowStyles && name === "style") {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if ((name === "href" || name === "src" || name === "xlink:href") && value.startsWith("javascript:")) {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (name === "srcdoc") {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (!this.settings.allowLinks && (element.tagName.toLowerCase() === "a" || name === "href")) {
                    element.removeAttribute(attribute.name);
                    return;
                }
            });
        });

        return template.innerHTML;
    }

    private postProcessLinks(): void {
        if (!this.settings.allowLinks) {
            const links = this.content.querySelectorAll("a");
            links.forEach(link => {
                const text = document.createTextNode(link.textContent || "");
                link.parentNode?.replaceChild(text, link);
            });
            return;
        }

        const links = this.content.querySelectorAll("a");
        links.forEach(link => {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
        });
    }

    private safeNumber(value: number, min: number, max: number): number {
        if (isNaN(value) || !isFinite(value)) {
            return min;
        }

        return Math.max(min, Math.min(max, value));
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
        const instances: VisualObjectInstance[] = [];

        if (options.objectName === "general") {
            instances.push({
                objectName: "general",
                displayName: "General",
                selector: null,
                properties: {
                    backgroundColor: {
                        solid: {
                            color: this.settings.backgroundColor
                        }
                    },
                    transparentBackground: this.settings.transparentBackground,
                    padding: this.settings.padding,
                    overflowMode: this.settings.overflowMode
                }
            });
        }

        if (options.objectName === "content") {
            instances.push({
                objectName: "content",
                displayName: "Content",
                selector: null,
                properties: {
                    horizontalAlign: this.settings.horizontalAlign,
                    verticalAlign: this.settings.verticalAlign,
                    scale: this.settings.scale,
                    showEmptyMessage: this.settings.showEmptyMessage
                }
            });
        }

        if (options.objectName === "security") {
            instances.push({
                objectName: "security",
                displayName: "Security",
                selector: null,
                properties: {
                    sanitizeHtml: this.settings.sanitizeHtml,
                    allowStyles: this.settings.allowStyles,
                    allowSvg: this.settings.allowSvg,
                    allowImages: this.settings.allowImages,
                    allowLinks: this.settings.allowLinks
                }
            });
        }

        return instances;
    }
}
