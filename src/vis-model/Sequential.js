/**
 * @author syt123450 / https://github.com/syt123450
 */

import { AbstractModel } from './AbstractModel';
import { MapModelConfiguration } from "../configure/MapModelConfiguration";
import { ModelLayerInterval } from "../utils/Constant";
import { MaxDepthInLayer } from "../utils/Constant";

function Sequential( container, config ) {

	AbstractModel.call( this, container );

	this.layers = [];

	this.configuration = new MapModelConfiguration( config );
	this.loadSceneConfig( this.configuration );

	this.hoveredLayer = undefined;

	this.inputValue = undefined;

	// create three.js actual scene
	this.createScene();

}

Sequential.prototype = Object.assign( Object.create( AbstractModel.prototype ), {

	add: function( layer ) {

		if ( this.layers.length !== 0 ) {

			if ( !layer.isMerged ) {

				let tailLayer = this.layers[ this.layers.length - 1 ];
				layer.setLastLayer( tailLayer );

			}

		}

		layer.setEnvironment( this.scene, this );
		layer.loadModelConfig( this.configuration );
		this.layers.push( layer) ;

		// may be layer want model information
		layer.assemble( this.layers.length, this );

	},

	init: function( callback ) {

		console.log("init prime sequential model");

		if ( this.hasLoader ) {

			let self = this;
			this.loader.load().then( function() {

				self.initVisModel();

				if ( callback !== undefined ) {

					callback();

				}

			} );

		} else {

			this.initVisModel();

			if ( callback !== undefined ) {

				callback();

			}

		}

	},

	registerSequentialEvent: function() {

		document.addEventListener( 'mousemove', function( event ) {

			this.onMouseMove( event );

		}.bind( this ), true );

		document.addEventListener( 'click', function( event ) {

			this.onClick( event );

		}.bind( this ), true );

	},

	onMouseMove: function( event ) {

		this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

		let model = this;

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		if ( model.hoveredLayer !== undefined ) {

			model.hoveredLayer.handleHoverOut();
			model.hoveredLayer = undefined;

		}

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.hoverable === true ) {

					let selectedLayer = this.layers[ selectedElement.layerIndex - 1 ];

					selectedLayer.handleHoverIn( selectedElement );

					this.hoveredLayer = selectedLayer;

					break;

				}

			}

		}

	},

	onClick: function ( event ) {

		let model = this;

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.clickable === true ) {

					let selectedLayer = this.layers[ selectedElement.layerIndex - 1 ];

					selectedLayer.handleClick( selectedElement );

					break;

				}

 			}

		}

	},

	initVisModel: function() {

		this.updateCamera( this.layers.length );
		this.createModel();
		this.registerModelEvent();
		this.registerSequentialEvent();
		this.animate();

		this.isInitialized = true;

	},

	createModel: function() {

		console.log( "creating prime sequential model..." );

		let layersPos = calculateLayersPos( this.layers );
		let layerActualDepth = calculateDepths( this );

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].init( layersPos[ i ], layerActualDepth[ i ] );

		}

		function calculateLayersPos( layers ) {

			let depth = layers.length;
			let layersPos = [];

			let initPos;

			if ( depth % 2 === 1 ) {

				initPos = - ModelLayerInterval * ( ( depth - 1 ) / 2 );

			} else {

				initPos = - ModelLayerInterval * ( depth / 2 ) + ModelLayerInterval / 2;

			}

			for ( let i = 0; i < depth; i++ ) {

				if ( !layers[ i ].isGroup  ) {

					layersPos.push( {

						x: 0,
						y: initPos,
						z: 0

					} );

					initPos += ModelLayerInterval;

				} else {

					let posArray = [];

					for ( let j = 0; j < layers[ i ].thickness; j ++ ) {

						posArray.push( {

							x: 0,
							y: initPos,
							z: 0

						} );

						initPos += ModelLayerInterval;

					}

					layersPos.push( posArray );

				}

			}

			return layersPos;

		}

		function calculateDepths( model ) {

			let depthList = [];
			let maxDepthValue = 0;
			let actualDepthList = [];

			for ( let i = 0; i < model.layers.length; i ++ ) {

				let layerDepth = model.layers[ i ].depth;

				if ( layerDepth !== undefined ) {

					maxDepthValue = maxDepthValue > layerDepth ? maxDepthValue : layerDepth;
					depthList.push( layerDepth );

				} else {

					depthList.push( 1 );

				}

			}

			for ( let i = 0; i < model.layers.length; i ++ ) {

				if ( depthList[ i ] / maxDepthValue * MaxDepthInLayer > 1 ) {

					actualDepthList.push( depthList[ i ] / maxDepthValue * MaxDepthInLayer );

				} else {

					actualDepthList.push( 1 );

				}

			}

			return actualDepthList;

		}

	},

	predict: function( input, callback ) {

		this.inputValue = input;

		if ( this.resource !== undefined ) {

			let inputShape = this.layers[ 0 ].shape;

			this.predictResult = this.predictor.predict( input, inputShape, callback );

		}

		this.updateLayerVis();

	},

	updateLayerVis: function() {

		this.updateInputVis();
		this.updateLayerPredictVis();

	},

	updateInputVis: function() {

		this.layers[ 0 ].updateValue( this.inputValue );

	},

	updateLayerPredictVis: function() {

		for ( let i = 1; i < this.layers.length; i ++ ) {

			if ( this.layers[i].layerType !== "YoloOutput" ) {

				let predictValue = this.predictResult[ i - 1 ].dataSync();

				this.layers[ i ].updateValue( predictValue );

			} else {

				this.layers[ i ].updateValue();

			}

		}

	},

	clear: function() {

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].clear();

		}

	}

} );

export { Sequential };