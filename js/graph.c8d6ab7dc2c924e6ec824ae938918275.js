async function drawGraph(url,
  baseUrl,
  pathColors,
  depth,
  enableDrag,
  enableLegend,
  enableZoom,
  scale,
  repelForce,
  centerForce,
  linkDistance,
  fontSize,
  opacityNode,
  labelBottom = true,
  squareFrame = false) {


  // var doc = jsyaml.load('greeting: hello\nname: world');

  // console.log(parse(doc))
  // Graph variable are in data/graphConfig.yaml


  // could add variables for text position dx dy on node
  // add varialbe for arrow, text-fade threshold, node size, link thickness,

  // -------------------

  const { index, links, content } = await fetchData
  const curPage = url.replace(baseUrl, "")

  const parseIdsFromLinks = (links) => [...(new Set(links.flatMap(link => ([link.source, link.target]))))]

  const neighbours = new Set()
  const wl = [curPage || "/", "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbours.add(cur)
        const outgoing = index.links[cur] || []
        const incoming = index.backlinks[cur] || []
        wl.push(...outgoing.map(l => l.target), ...incoming.map(l => l.source))
      }
    }
  } else {
    parseIdsFromLinks(links).forEach(id => neighbours.add(id))
  }

  const data = {
    nodes: [...neighbours].map(id => ({ id })),
    links: links.filter(l => neighbours.has(l.source) && neighbours.has(l.target)),
  }

  const color = (d) => {
    if (d.id === curPage || (d.id === "/" && curPage === "")) {
      return "var(--g-node-active)"
    }

    for (const pathColor of pathColors) {
      const path = Object.keys(pathColor)[0]
      const colour = pathColor[path]
      if (d.id.startsWith(path)) {
        return colour
      }
    }

    return "var(--g-node)"
  }

  const drag = simulation => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(1).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    const noop = () => { }
    return d3.drag()
      .on("start", enableDrag ? dragstarted : noop)
      .on("drag", enableDrag ? dragged : noop)
      .on("end", enableDrag ? dragended : noop);
  }

  const height = squareFrame ? 500 : 250;
  const width = document.getElementById("graph-container").offsetWidth

  // simulation

  const simulation = d3.forceSimulation(data.nodes)
    .force("charge", d3.forceManyBody().strength(-100 * repelForce))
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(40))
    // .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX(0).strength(0.1))
    .force("y", d3.forceY(0).strength(0.1))
  // .force("collide", d3.forceCollide(9))
  // .force("x", d3.forceX(width / 2).strength(0.02)
  //   .force("y", d3.forceY(height / 2).strength(0.02)

  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr("viewBox", [-width / 2 * 1 / scale, -height / 2 * 1 / scale, width * 1 / scale, height * 1 / scale])
    .style("font-size", fontSize);


  if (enableLegend) {
    const legend = [
      { "Current": "var(--g-node-active)" },
      { "Note": "var(--g-node)" },
      ...pathColors
    ]
    legend.forEach((legendEntry, i) => {
      const key = Object.keys(legendEntry)[0]
      const colour = legendEntry[key]
      svg.append("circle").attr("cx", -width / 2 + 20).attr("cy", height / 2 - 30 * (i + 1)).attr("r", 6).style("fill", colour)
      svg.append("text").attr("x", -width / 2 + 40).attr("y", height / 2 - 30 * (i + 1)).text(key).style("font-size", "15px").attr("alignment-baseline", "middle")
    })
  }

  // draw links between nodes

  const link = svg.append("g")
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("marker-end", "url(#arrow)")
    .attr("class", "link")
    .attr("stroke", "var(--g-link)")
    .attr("stroke-width", 2)
    .attr("data-source", d => d.source.id)
    .attr("data-target", d => d.target.id)

  // build the arrow.
  const arrow = svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", 0)
    .attr("opacity", 1)
    .attr("markerWidth", 3)
    .attr("markerHeight", 3)
    .attr("orient", "auto")
    .attr("fill", "var(--g-link)")
    .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");


  // svg groups
  const graphNode = svg.append("g")
    .selectAll("g")
    .data(data.nodes)
    .enter().append("g")

  // calculate node Radious

  const nodeRadius = (d) => {
    const numOut = index.links[d.id]?.length || 0;
    const numIn = index.backlinks[d.id]?.length || 0;
    return 3 + (numOut + numIn) / 4;
  }

  // draw individual nodes

  const node = graphNode.append("circle")
    .attr("class", "node")
    .attr("id", (d) => d.id)
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", color)
    .style("cursor", "pointer")
    .on("click", (_, d) => {
      window.location.href = baseUrl + '/' + decodeURI(d.id).replace(/\s+/g, '-')
    })
    .on("mouseover", function (_, d) {
      d3.selectAll(".node")
        .transition()
        .duration(100)
        .attr("fill", "var(--g-node-inactive)")

      const neighbours = parseIdsFromLinks([...(index.links[d.id] || []), ...(index.backlinks[d.id] || [])])
      const neighbourNodes = d3.selectAll(".node").filter(d => neighbours.includes(d.id))
      const currentId = d.id
      const linkNodes = d3.selectAll(".link").filter(d => d.source.id === currentId || d.target.id === currentId)
      // const arrowNodes = d3.selectAll("#arrow").filter(d => d.source.id === currentId || d.target.id === currentId)

      // highlight neighbour nodes
      neighbourNodes
        .transition()
        .duration(200)
        .attr("fill", color)

      // highlight links
      linkNodes
        .transition()
        .duration(200)
        .attr("stroke", "var(--g-link-active)")

      // arrowNodes.transition()
      //   .duration(200)
      //   .attr("fill", "var(--g-link-active)")

      // show text for self
      d3.select(this.parentNode)
        .select("text")
        .raise()
        .transition()
        .duration(200)
        .style("opacity", 1)
    }).on("mouseleave", function (_, d) {

      const currentId = d.id
      const linkNodes = d3.selectAll(".link").filter(d => d.source.id === currentId || d.target.id === currentId)

      console.log(repelForce);

      linkNodes
        .transition()
        .duration(200)
        .attr("stroke", "var(--g-link)")

      d3
        .selectAll("text")
        .raise()
        .transition()
        .duration(200)
        .style("opacity", opacityNode)

      d3.selectAll(".node")
        .transition()
        .duration(200)
        .attr("fill", color)

    })
    .call(drag(simulation));

  // draw labels

  const labels = graphNode.append("text")
    .attr("dx", labelBottom ? 0 : d => nodeRadius(d) + 4 + "px") // radius is in px
    .attr("dy", labelBottom ? d => nodeRadius(d) + 8 + "px" : ".35em") // radius is in px 
    .attr("text-anchor", labelBottom ? "middle" : "start")
    .text((d) => content[d.id]?.title || d.id.replace("-", " "))
    .style("opacity", opacityNode)
    // .clone(true).lower()
    //   .attr("fill", "none")
    //   .attr("stroke", "white")
    //   .attr("stroke-width", 3);
    .raise()
    .call(drag(simulation));



  // for testiing

  // const test = svg
  //     .append("text")
  //     .style("font-size", "12px")
  //     // .text("Test");
  //     .text(content);

  // console.log(content); // /.obsidian dosen't apear in content.
  // console.log(content[]); // /.obsidian dosen't apear in content.
  // console.log(content[""]); // /.obsidian dosen't apear in content.
  // console.log(content[""].scale); // /.obsidian dosen't apear in content.

  // set panning

  if (enableZoom) {
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.25, 4])
      .on("zoom", ({ transform }) => {
        link.attr("transform", transform);
        labels.attr("transform", transform);
        node.attr("transform", transform).raise();
      }));
  }

  // progress the simulation
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y)

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .raise()

  });
}