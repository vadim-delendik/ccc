
/**
 * LineDotAreaAbstract is the class that will be extended by
 * dot, line, stackedline and area charts.
 */
pvc.LineDotAreaAbstract = pvc.CategoricalAbstract.extend({

    _hasDataPartRole: function(){
        return true;
    },
    
    /**
     * Initializes each chart's specific roles.
     * @override
     */
    _initVisualRoles: function(){
        
        this.base();
        
        this._addVisualRoles({
            /* value: required, continuous, numeric */
            value: { 
                isMeasure: true, 
                isRequired: true, 
                isPercent: this.options.stacked,  
                requireSingleDimension: true, 
                requireIsDiscrete: false, 
                valueType: Number, 
                defaultDimensionName: 'value' 
            }
        });
    },

    _bindAxes: function(hasMultiRole){
        
        if(!hasMultiRole || this.parent){
            
            var options = this.options;
            var isStacked = !!options.stacked;
            var nullInterpolationMode = options.nullInterpolationMode;
            var axes = this.axes;
            var valueRole = this.visualRoles('value');
            
            if(!options.secondAxis){
                axes.ortho 
                    .bind({
                        role: valueRole,
                        isStacked: isStacked,
                        nullInterpolationMode: nullInterpolationMode
                    });
            } else {
                if(options.secondAxisIndependentScale){
                    // Separate scales =>
                    // axis ortho 0 represents data part 0
                    // axis ortho 1 represents data part 1
                    axes.ortho 
                        .bind({
                            role: valueRole,
                            dataPartValue: '0',
                            isStacked: isStacked,
                            nullInterpolationMode: nullInterpolationMode
                        });
                    
                    axes.ortho2
                        .bind({
                            role: valueRole,
                            dataPartValue: '1',
                            isStacked: isStacked,
                            nullInterpolationMode: nullInterpolationMode
                        });
                } else {
                    // Common scale => 
                    // axis ortho 0 represents both data parts
                    var orthoDataCells = [{
                            role: valueRole,
                            dataPartValue: '0',
                            isStacked: isStacked,
                            nullInterpolationMode: nullInterpolationMode
                        }, {
                            role: valueRole,
                            dataPartValue: '1',
                            isStacked: isStacked,
                            nullInterpolationMode: nullInterpolationMode
                        }
                    ];
                    
                    axes.ortho.bind(orthoDataCells);
                    
                    // TODO: Is it really needed to setScale on ortho2???
                    // We set this here also so that we can set a scale later.
                    // This is not used though, cause the scale
                    // will be that calculated by 'ortho'...
                    axes.ortho2.bind(orthoDataCells);
                }
                
                // ------
                
                // TODO: should not this be the default color axes binding of BaseChart??
                var colorRoleName = this.legendSource;
                if(colorRoleName){
                    var colorRole;
                    
                    ['color', 'color2'].forEach(function(axisId){
                        var colorAxis = this.axes[axisId];
                        if(colorAxis){
                            if(!colorRole){
                                colorRole = this.visualRoles(colorRoleName);
                            }
                            
                            colorAxis.bind({
                                role: colorRole,
                                dataPartValue: '' + colorAxis.index
                            });
                        }
                    }, this);
                }
            }
        }
        
        this.base(hasMultiRole);
    },
    
    /* @override */
    _createMainContentPanel: function(parentPanel, baseOptions){
        if(pvc.debug >= 3){
            pvc.log("Prerendering in LineDotAreaAbstract");
        }
        
        var options = this.options;
        var options2 = def.create(baseOptions, {
            stacked:        options.stacked,
            showValues:     options.showValues,
            valuesAnchor:   options.valuesAnchor,
            showLines:      options.showLines,
            showDots:       options.showDots,
            showAreas:      options.showAreas,
            orientation:    options.orientation
        });
        
        var linePanel = this.scatterChartPanel = new pvc.LineDotAreaPanel(this, parentPanel, def.create(options2, {
            colorAxis:      this.axes.color,
            dataPartValue:  options.secondAxis ? '0' : null
        }));
        
        if(options.secondAxis){
            if(pvc.debug >= 3){
                pvc.log("Creating second LineDotArea panel.");
            }
            
            this.scatterChartPanel2 = new pvc.LineDotAreaPanel(this, parentPanel, def.create(options2, {
                extensionPrefix: 'second',
                colorAxis:       this.axes.color2,
                dataPartValue:   '1'
            }));
        }
        
        return linePanel;
    },
    
    defaults: def.create(pvc.CategoricalAbstract.prototype.defaults, {
        showDots: false,
        showLines: false,
        showAreas: false,
        showValues: false,
        // TODO: Set this way, setting, "axisOffset: 0" has no effect...
        orthoAxisOffset: 0.04,
        baseAxisOffset:  0.01, // TODO: should depend on being discrete or continuous base
        valuesAnchor: "right",
        panelSizeRatio: 1, 
        tipsySettings: { offset: 15 }
    })
});

/**
 * Dot Chart
 */
pvc.DotChart = pvc.LineDotAreaAbstract.extend({

    constructor: function(options){

        this.base(options);

        this.options.showDots = true;
    }
});

/**
 * Line Chart
 */
pvc.LineChart = pvc.LineDotAreaAbstract.extend({

    constructor: function(options){

        this.base(options);

        this.options.showLines = true;
    }
});

/**
 * Stacked Line Chart
 */
pvc.StackedLineChart = pvc.LineDotAreaAbstract.extend({

    constructor: function(options){

        this.base(options);

        this.options.showLines = true;
        this.options.stacked = true;
    }
});

/**
 * Stacked Area Chart
 */
pvc.StackedAreaChart = pvc.LineDotAreaAbstract.extend({

    constructor: function(options){

        this.base(options);

        this.options.showAreas = true;
        this.options.stacked = true;
    }
});
