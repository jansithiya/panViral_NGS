/**
 *  Redesign of panViral NGS pipe line  and assigned name visuals
 */

/* define svg width and height for bubble chart */

var margin = {top: 20, bottom: 20, left: 20, right: 20};
var width = 1500 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

var svg = d3.select("#taxChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

//color for bubbles
var color = d3.scaleOrdinal(d3.schemeCategory20);

//bubble layout
var pack = d3.pack()
    .size([400, height - 100])
    .padding(5);

//pipeline visualization svg creation and dimensions
var widthPipeline = 1500 - margin.left - margin.right, heightPipeline = 350 - margin.top - margin.bottom;
var svgPipeline = d3.select("#pipeline")
    .append("svg")
    .attr("width", widthPipeline + margin.left + margin.right)
    .attr("height", heightPipeline + margin.top + margin.bottom)

// Define tooltip to used through out the visuals wherever needed
var toolTip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

/* data loading and processing */
d3.xml("./data/ngs-results.xml", function (error, data) {

    if (error) throw error;

    console.log(data);

    /* Array that stores pipeline related info such as time taken for each step, read count, etc., */
    var pipeLine = [];

    //parse the xml file to obtain specific fields
    var init_endTime = +data.querySelector("init > end-time-ms").textContent,
        qc1_read_Length = +data.querySelector("qc1 > read-length").textContent,
        qc1_read_count = +data.querySelector("qc1 > read-count").textContent,
        qc1_endTime = +data.querySelector("qc1 > end-time-ms").textContent,
        preProcessing_endTime = +data.querySelector("preprocessing > end-time-ms").textContent,
        qc2_read_Length = +data.querySelector("qc2 > read-length").textContent,
        qc2_read_count = +data.querySelector("qc2 > read-count").textContent,
        qc2_endTime = +data.querySelector("qc2 > end-time-ms").textContent,
        filtering_endTime = +data.querySelector("filtering > end-time-ms").textContent,
        Assembly_endTime = +data.querySelector("assembly > end-time-ms").textContent,
        preProcessing_read_count = 1611112;
    /* ??? to update with right number when more info */

    /* create an array that stores all the bucket and reads associated this is from the filtering tag of the xml file */
    var filtering_Data = [].map.call(data.querySelectorAll("diamond-bucket"), function (bucket) {

        return {
            bucketId: bucket.getAttribute("id"),
            ancestors: bucket.querySelector("ancestors").textContent,
            sci_name: bucket.querySelector("scientific-name").textContent,
            reads: +bucket.querySelector("read-count-total").textContent

        }
    });

    /* push the filtering read count to the pipleline object */
    var filtering_read_count = d3.sum(filtering_Data, function (d) {
        return d.reads;
    });

    /* create an array that stores all the assembly data and taxonomy  associated this is from the assembly tag of the xml file
    *  Note: reads are calculated as (cov * length)/QC2_read_length whereas cov and length are obtained from contig tag
    * */
    var Assembly_Data = [].map.call(data.querySelectorAll("bucket"), function (bucket) {

        if (bucket.querySelector("sequence")) {
            return {
                bucketId: bucket.querySelector("diamond_bucket").textContent,
                assigned_name: bucket.querySelector("sequence > conclusion > assigned > name").textContent,
                reads: ((+bucket.querySelector("contigs > contig > cov").textContent) * (+bucket.querySelector("contigs > contig > length").textContent))/qc2_read_Length
            }
        }
        else {
            return {
                bucketId: bucket.querySelector("diamond_bucket").textContent,
                assigned_name: null,
                reads:null
            }
        }
    });

    console.log(filtering_Data);
    console.log(Assembly_Data);

    var prepared_data = Assembly_Data.filter(function (d) {
        return d.reads != null;
    });
    //count the assembly reads
    var Assembly_readCount = d3.sum(prepared_data, function (d) {
        return d.reads;
    });

    //push all the pipeline values to array created above
    pipeLine.push({
            step: "QC1",
            reads: qc1_read_count,
            endTime: qc1_endTime,
            endTime_minutes: Math.floor(qc1_endTime / 60000)
        },
        {
            step: "Preprocesing",
            reads: preProcessing_read_count,
            endTime: preProcessing_endTime,
            endTime_minutes: Math.floor(preProcessing_endTime / 60000)
        },
        {step: "QC2", reads: qc2_read_count, endTime: qc2_endTime, endTime_minutes: Math.floor(qc2_endTime / 60000)},
        {
            step: "Filtering",
            reads: filtering_read_count,
            endTime: filtering_endTime,
            endTime_minutes: Math.floor(filtering_endTime / 60000)
        },
        {
            step: "Assembly",
            reads: Assembly_readCount,
            endTime: Assembly_endTime,
            endTime_minutes: Math.floor(Assembly_endTime / 60000)
        });

    console.log(pipeLine);

    bubbleChart(prepared_data);
    pipeLineChart(pipeLine);

});


function bubbleChart(data) {

    // structure the data in a way to fetch unique assigned name and total read counts
    var nodeData = d3.nest()
        .key(function (d) {
            return d.assigned_name;
        })
        .rollup(function (reads) {
            return d3.sum(reads, function (d) {
                return d.reads
            });
        })
        .entries(data);

    console.log(nodeData);

    //preparing the data suitable for bubble chart layout in d3 similar to hierarchy data preparation
    var root = d3.hierarchy({children: nodeData})
        .sum(function (d) {
            return d.value;
        })
        .sort(function (a, b) {
            return -(a.value - b.value);   //sort to pack the bubbles efficiently
        })
        .each(function (d) {
            if (id = d.data.key) {
                var id;
                d.id = id;
            }

        });

    pack(root);    //get the x and y positions to layout the bubbles pack


    var node = svg.selectAll(".node")
        .data(root.children)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    node.append("circle")
        .attr("id", function (d) {
            return d.id;
        })
        .attr("r", function (d) {
            return d.r;
        })
        .style("fill", function (d) {
            return color(d.data.key);
        })
        .on("mouseover", function (d) {
            toolTip.transition()       //TOOLTIP
                .duration(200)
                .style("opacity", .9);
            toolTip.html("<b>" + "Name: " + "</b>" + d.data.key + "<br/>" + "<b>" + "Reads: " + "</b>" + d.value)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            toolTip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    node.append("title")
        .text(function (d) {
            return d.data.key + ": " + d.value;
        });

    node.append("text")
        .attr("dy", ".3em")
        .style("text-anchor", "middle")
        .text(function (d) {
            if (d.r > 10) {
                return d.data.key.substring(0, d.r / 3);
            }
        });

    // legend for the bubble chart
    var legendCircle = svg.selectAll("g.legend")
        .data(nodeData)
        .enter()
        .append("g")
        .attr("class", "legend");

    legendCircle.append("circle")
        .attr("transform", "translate(" + 500 + "," + 60 + ")")
        .attr("cx", 0)
        .attr("cy", function (d, i) {
            return i * 20
        })
        .attr("r", 8)
        .style("fill", function (d) {
            return color(d.key)
        });

    legendCircle.append("text")
        .attr("transform", "translate(" + 520 + "," + 60 + ")")
        .attr("dx", 0)
        .attr("dy", function (d, i) {
            return (i * 20) + 5
        })
        .text(function (d) {
            return d.key;
        })
        .style("font-size", "11px");

}

function pipeLineChart(pipeLine) {


    var rectHeight = 40, rectMargin = 42;

    var rectColorPalette = ["#006ba4", "#ff800e", "#ababab", "#595959", "#5f9ed1"]; //color blind safe for rect fill in pipeline

    var widthMap = d3.scaleLinear()
        .domain([0, pipeLine[0].reads])
        .range([0, 300]);

    // title for pipeline visualizations
    var pipeLine_title = svgPipeline.append("text")
        .attr("dx", 120)
        .attr("dy", 20)
        .text("Pan Viral NGS - Pipeline and processing time")
        .style("font-size", "18px")
        .style("text-align", "center")
        .style("fill", "#08306b")
        .style("font-weight", "bold")

    var pipeLine_selection = svgPipeline.selectAll("g.pipeline")
        .data(pipeLine)
        .enter()
        .append("g")
        .attr("class", "pipeline")
        .attr("transform", "translate(" + 20 + "," + 20 + ")");
    //text for pipeline visualization
    pipeLine_selection.append("text")
        .attr("transform", "translate(" + 0 + "," + 60 + ")")
        .attr("class", "stepText")
        .attr("dx", 0)
        .attr("dy", function (d, i) {
            return (i * rectMargin) + (rectHeight) / 2 + 5;
        })
        .text(function (d) {
            return d.step;
        });

    //draw rectangles
    pipeLine_selection.append("rect")
        .attr("transform", "translate(" + 120 + "," + 60 + ")")
        .attr("x", function (d, i) {
            var pos = (pipeLine[0].reads - d.reads) / 2;
            return widthMap(pos);
        })
        .attr("y", function (d, i) {
            return ((i * rectMargin));
        })
        .attr("width", function (d) {
            return widthMap(d.reads)
        })
        .attr("height", rectHeight)
        .attr("fill", function (d, i) {
            return rectColorPalette[i]
        });

    // print text next to the specific pipeline step
    pipeLine_selection.append("text")
        .attr("class", "readsText")
        .attr("transform", "translate(" + 120 + "," + 60 + ")")
        .attr("dx", function (d, i) {
            var pos = (pipeLine[0].reads - d.reads) / 2;
            return widthMap(pos) + widthMap(d.reads) + 20;
        })
        .attr("dy", function (d, i) {
            return (i * rectMargin) + (rectHeight) / 2 + 5;
        })
        .text(function (d) {
            return parseInt(d.reads);
        });


    // End time visualization similar to GANTT

    var endTime = pipeLine[4].endTime;//end time ms to minutes conversion
    var endTimeMap = d3.scaleLinear()
        .domain([0, endTime])
        .range([0, 350])
        .nice();

    //draw axis in the top that display time in minutes
    var endTime_Axis = d3.axisTop(endTimeMap)
        .ticks(5)
        .tickFormat(function (d) {
            return parseInt(d / 60000);
        });

    pipeLine_selection.append("g")
        .attr("class", "axisTicks")
        .attr("transform", "translate(" + 600 + "," + 40 + ")")
        .call(endTime_Axis);

    //title for the axis
    pipeLine_selection.append("text")
        .attr("class", "axisLabel")
        .attr("transform", "translate(" + 960 + "," + 40 + ")")
        .attr("x", 0)
        .attr("y", 0)
        .text("Time(minutes)");

    //render gantt view to visualize end time
    pipeLine_selection.append("line")
        .attr("transform", "translate(" + 0 + "," + 60 + ")")
        .attr("x1", 0)
        .attr("y1", function (d, i) {
            return ((i * rectMargin) + rectHeight);
        })
        .attr("x2", 950)
        .attr("y2", function (d, i) {
            return ((i * rectMargin) + rectHeight);
        })
        .style("stroke", "black")
        .style("stroke-width", 0.1);

    pipeLine_selection.append("rect")
        .attr("transform", "translate(" + 600 + "," + 60 + ")")
        .attr("x", function (d, i) {
            if (i == 0) {
                return 0;
            }
            else {
                return endTimeMap(pipeLine[i - 1].endTime);
            }
        })
        .attr("y", function (d, i) {
            return ((i * rectMargin) + 10);
        })
        .attr("width", function (d, i) {
            if (i == 0) {
                return endTimeMap(d.endTime)
            } else {
                return (endTimeMap(d.endTime) - endTimeMap(pipeLine[i - 1].endTime))
            }
        })
        .attr("height", 10)
        .attr("fill", "#de2d26")
        .on("mouseover", function (d) {
            toolTip.transition()  //TOOLTIP
                .duration(200)
                .style("opacity", .9);
            toolTip.html("<b>" + "Step: " + "</b>" + d.step + "<br/>" + "<b>" + "end time (ms): " + "</b>" + d.endTime + "<br/>" + "<b>" + "end time (min): " + "</b>" + parseInt(d.endTime / 60000))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            toolTip.transition()
                .duration(500)
                .style("opacity", 0);
        });


}


