// ==UserScript==
// @name         pixiv-previewer
// @namespace    obgnail
// @version      0.1
// @description  Makes pixiv codes more useful,supports 6-9 bits codes
// @author       obgnail
// @match        https://*/*
// @icon         https://www.google.com/s2/favicons?domain=pixiv.net
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// ==/UserScript==


(function () {
    'use strict';
    // const PIXIV_REGEX = new RegExp("pid[:：=\-]?([0-9]{6,9})", "gi");
    const PIXIV_REGEX = new RegExp("pid[^0-9]?([0-9]{6,9})", "gi");
    const ARTLINK_CLASS = 'artlink';
    const IMAGE_INTRO_CLASS = 'image-intro'
    const ARTCODE_ATTRIBUTE = 'artcode';

    const DEFAULT_HEADERS = {
        "referer": "https://www.pixiv.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:67.0)"
    }
    const css = `
        .imagepopup {
            min-width: 600px !important;
            z-index: 50000 !important;
            max-width: 80% !important;
            position: fixed !important;
            line-height: 1.4em;
            font-size:1.1em!important;
            margin-bottom: 10px;
            box-shadow: 0 0 .125em 0 rgba(0,0,0,.5);
            border-radius: 0.5em;
            background-color:#8080C0;
            color:#F6F6F6;
            text-align: left;
            padding: 10px;
        }

        .imagepopup img {
            width: 270px;
            height: auto;
            margin: 3px 15px 3px 3px;
        }

        .image-title {
            font-size: 1.4em;
            font-weight: bold;
            text-align: center;
            margin: 5px 10px 0 0;
            display: block;
        }

        .artcode {
            text-align: center;
            font-size: 1.2em;
            font-style: italic;
            opacity: 0.3;
        }

        .message {
            height: 210px;
            line-height: 210px;
            text-align: center;
        }

        .discord-dark {
            background-color: #36393f;
            color: #dcddde;
            font-size: 0.9375rem;
        }
    `

    function getAdditionalPopupClasses() {
        const hostname = document.location.hostname;
        switch (hostname) {
            case "discord.com":
                return "discord-dark";
            case "reddit.com":
                return "post reply";
            case "tieba.baidu.com":
                return "post reply";
            default:
                return null;
        }
    }

    function requestImage(url, imgHandler) {
        getXmlHttpRequest()({
            method: "GET",
            url,
            headers: DEFAULT_HEADERS,
            responseType: "blob",
            onload: function (resp) {
                const img = document.createElement("img");
                if (resp.readyState === 4 && resp.status === 200) {
                    img.src = window.URL.createObjectURL(resp.response);
                } else if (resp.readyState === 4 && resp.status === 404) {
                    console.log("work not found")
                }
                imgHandler(img)
            },
        })
    }

    function getXmlHttpRequest() {
        return (typeof GM !== "undefined" && GM !== null ? GM.xmlHttpRequest : GM_xmlhttpRequest);
    }

    const Parser = {
        walkNodes: function (elem) {
            const nodeTreeWalker = document.createTreeWalker(
                elem,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function (node) {
                        if (node.parentElement.classList.contains(ARTLINK_CLASS))
                            return NodeFilter.FILTER_ACCEPT;
                        if (node.nodeValue.match(PIXIV_REGEX))
                            return NodeFilter.FILTER_ACCEPT;
                    }
                },
                false,
            );
            while (nodeTreeWalker.nextNode()) {
                const node = nodeTreeWalker.currentNode;
                if (node.parentElement.classList.contains(ARTLINK_CLASS))
                    Parser.rebindEvents(node.parentElement);
                else
                    Parser.linkify(node);
            }
        },

        wrapArtCode: function (art) {
            var e;
            e = document.createElement("a");
            e.classList = ARTLINK_CLASS;
            e.href = "javascript:;"
            e.innerHTML = art.value;
            e.setAttribute(ARTCODE_ATTRIBUTE, art.number);
            e.addEventListener("mouseover", Popup.over);
            e.addEventListener("mouseout", Popup.out);
            e.addEventListener("mousemove", Popup.move);
            e.addEventListener("click", Popup.open)
            e.addEventListener("dblclick", Popup.download)
            return e;
        },

        linkify: function (textNode) {
            const nodeOriginalText = textNode.nodeValue;
            const matches = [];

            let match;
            while (match = PIXIV_REGEX.exec(nodeOriginalText)) {
                matches.push({
                    index: match.index,
                    value: match[0],
                    number: match[1],
                });
            }

            // Keep text in text node until first code
            textNode.nodeValue = nodeOriginalText.substring(0, matches[0].index);

            // Insert rest of text while linkifying codes
            let prevNode = null;
            for (let i = 0; i < matches.length; ++i) {

                // Insert linkified code
                const linkNode = Parser.wrapArtCode(matches[i]);
                textNode.parentNode.insertBefore(
                    linkNode,
                    prevNode ? prevNode.nextSibling : textNode.nextSibling,
                );

                // Insert text after if there is any
                let upper;
                if (i === matches.length - 1)
                    upper = undefined;
                else
                    upper = matches[i + 1].index;
                let substring;
                if (substring = nodeOriginalText.substring(matches[i].index + matches[i].value.length, upper)) {
                    const subtextNode = document.createTextNode(substring);
                    textNode.parentNode.insertBefore(
                        subtextNode,
                        linkNode.nextElementSibling,
                    );
                    prevNode = subtextNode;
                } else {
                    prevNode = linkNode;
                }
            }
        },

        rebindEvents: function (elem) {
            if (elem.nodeName === "A") {
                elem.addEventListener("mouseover", Popup.over);
                elem.addEventListener("mouseout", Popup.out);
                elem.addEventListener("mousemove", Popup.move);
                elem.addEventListener("click", Popup.open)
                elem.addEventListener("dblclick", Popup.download)
            } else {
                const imagelinks = elem.querySelectorAll("." + ARTLINK_CLASS);
                for (var i = 0, max = imagelinks.length; i < max; i++) {
                    const artlink = imagelinks[i];
                    artlink.addEventListener("mouseover", Popup.over);
                    artlink.addEventListener("mouseout", Popup.out);
                    artlink.addEventListener("mousemove", Popup.move);
                    artlink.addEventListener("click", Popup.open)
                    artlink.addEventListener("dblclick", Popup.download)
                }
            }
        },

    }

    const Popup = {
        _time: 300,
        _timeout: 250,

        makePopup: function (e, code) {
            const popup = document.createElement("div");
            popup.className = "imagepopup " + (getAdditionalPopupClasses() || '');
            popup.id = "img-" + code;
            popup.style = "display: flex";
            document.body.appendChild(popup);

            popup.innerHTML = "<div class='message'>Searching...</span>";

            PixivNet.request(code, function (workInfo) {
                if (workInfo === null) {
                    popup.innerHTML = "<div class='message'>Work not found.</span>";
                } else {
                    requestImage(workInfo.img, function (img) {
                        imgContainer.appendChild(img);
                    })

                    const imgContainer = document.createElement("div")

                    let html = `<div class=${IMAGE_INTRO_CLASS}>
                            Title: <a>${workInfo.title}</a><br />
                            Code: <a>${workInfo.code}</a><br />
                            Author: <a>${workInfo.author}</a><br />
                    `;

                    if (workInfo.createDate) {
                        const d = new Date(workInfo.createDate);
                        const Y = d.getFullYear();
                        const M = d.getMonth() + 1;
                        const D = d.getDate();
                        const times = Y + (M < 10 ? "-0" : "-") + M + (D < 10 ? "-0" : "-") + D;
                        html += `Release: <a>${times}</a> <br />`;
                    }

                    html += `Like: <a>${workInfo.likeCount}</a><br />
                             Page: <a>${workInfo.pageCount}</a><br />
                             Size: <a>${workInfo.width} × ${workInfo.height}</a><br />
                    `;

                    // tags
                    html += `Tags: <a>`
                    for (var i = 0, max = workInfo.tags.length; i < max; i++) {
                        html += workInfo.tags[i] + "\u3000";
                    }
                    html += "</a><br />";

                    if (workInfo.description.length !== 0) {
                        let desc = workInfo.description
                        let maxLen = 200
                        if (desc.length > maxLen) {
                            desc = desc.substring(0, maxLen) + "..."
                        }
                        html += `Desc: <a>${desc}</a><br />`
                    }

                    html += "</div>";
                    popup.innerHTML = html;

                    popup.insertBefore(imgContainer, popup.childNodes[0]);
                }

                Popup.move(e);
            });
        },

        over: function (e) {
            const code = e.target.getAttribute(ARTCODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                const style = popup.getAttribute("style").replace("none", "flex");
                popup.setAttribute("style", style);
            } else {
                Popup.makePopup(e, code);
            }
        },

        out: function (e) {
            const code = e.target.getAttribute(ARTCODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                const style = popup.getAttribute("style").replace("flex", "none");
                popup.setAttribute("style", style);
            }
        },

        move: function (e) {
            const code = e.target.getAttribute(ARTCODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                if (popup.offsetWidth + e.clientX + 10 < window.innerWidth - 10) {
                    popup.style.left = (e.clientX + 10) + "px";
                } else {
                    popup.style.left = (window.innerWidth - popup.offsetWidth - 10) + "px";
                }

                if (popup.offsetHeight + e.clientY + 50 > window.innerHeight) {
                    popup.style.top = (e.clientY - popup.offsetHeight - 8) + "px";
                } else {
                    popup.style.top = (e.clientY + 20) + "px";
                }
            }
        },

        open: function (e) {
            clearTimeout(Popup._time);
            Popup._time = setTimeout(function () {
                const code = e.target.getAttribute(ARTCODE_ATTRIBUTE);
                let url = `https://www.pixiv.net/artworks/${code}`
                window.open(url, "_blank");
            }, Popup._timeout)
        },

        download: function (e) {
            clearTimeout(Popup._time);

            const code = e.target.getAttribute(ARTCODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            let imageIntro = popup.getElementsByClassName(IMAGE_INTRO_CLASS)[0]

            let _div;
            let titles = imageIntro.getElementsByClassName("image-title")
            if (titles.length === 0) {
                _div = document.createElement("div");
                _div.className = "image-title";
            } else {
                _div = titles[0];
            }
            console.log(titles, _div)
            _div.innerText = "Downloading...";

            imageIntro.insertBefore(_div, imageIntro.firstChild);

            let once = true;
            PixivNet.request(code, function (workInfo) {
                if (workInfo === null) {
                    alert("work not found");
                    return
                }

                let first = workInfo.original_img
                let splashIdx = first.lastIndexOf("/")
                let basename = first.substring(splashIdx + 1)
                let dir = first.substring(0, splashIdx) + "/"

                for (var i = 0, max = workInfo.pageCount; i < max; i++) {
                    let newBasename = basename.replace("p0", `p${i}`);
                    let newUrl = dir + newBasename;

                    requestImage(newUrl, function (img) {
                        let _basename = newBasename;
                        const link = document.createElement('a');
                        link.href = img.src;
                        link.download = _basename;
                        link.click();

                        if (once) {
                            _div.innerText = "Downloaded";
                            once = false;
                        }
                    })
                }
            });
        }
    }

    const PixivNet = {
        parseWorkDOM: function (dom, code) {
            const content = dom.getElementById("meta-preload-data").getAttribute("content");
            const message = JSON.parse(content);

            const image = message["illust"][code];

            const workInfo = {};
            workInfo.code = code;
            workInfo.img = image["urls"]["small"];
            workInfo.original_img = image["urls"]["original"];
            workInfo.width = image["width"];
            workInfo.height = image["height"]
            workInfo.pageCount = image["pageCount"]
            workInfo.title = image["illustTitle"];
            workInfo.author = image["userName"];
            workInfo.likeCount = image["likeCount"];
            workInfo.createDate = image["createDate"];
            workInfo.uploadDate = image["uploadDate"]
            workInfo.description = image["description"]

            workInfo.tags = [];
            for (var i = 0, max = image["tags"]["tags"].length; i < max; i++) {
                const tag = image["tags"]["tags"][i];
                const name = tag["translation"] ? tag["translation"]["en"] : tag["tag"];
                workInfo.tags.push(name);
            }
            return workInfo;
        },

        request: function (code, callback) {
            const url = `https://www.pixiv.net/artworks/${code}`;
            getXmlHttpRequest()({
                method: "GET",
                url,
                headers: DEFAULT_HEADERS,
                onload: function (resp) {
                    if (resp.readyState === 4 && resp.status === 200) {
                        const dom = new DOMParser().parseFromString(resp.responseText, "text/html");
                        const workInfo = PixivNet.parseWorkDOM(dom, code);
                        callback(workInfo);
                    } else if (resp.readyState === 4 && resp.status === 404) {
                        callback(null)
                    }
                },
            });
        },
    }

    document.addEventListener("DOMContentLoaded", function () {
        const style = document.createElement("style");
        style.innerHTML = css;
        document.head.appendChild(style);

        Parser.walkNodes(document.body);

        const observer = new MutationObserver(function (m) {
            for (let i = 0; i < m.length; ++i) {
                let addedNodes = m[i].addedNodes;

                for (let j = 0; j < addedNodes.length; ++j) {
                    Parser.walkNodes(addedNodes[j]);
                }
            }
        });

        document.addEventListener("securitypolicyviolation", function (e) {
            if (e.blockedURI.includes("www.pixiv.net")) {
                const img = document.querySelector(`img[src="${e.blockedURI}"]`);
                img.remove();
            }
        });

        observer.observe(document.body, {childList: true, subtree: true})
    });
})();