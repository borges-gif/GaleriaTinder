import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

import {
  Asset,
  AssetField,
  Album,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

export default function App() {
  // ============================================================
  // ESTADOS
  // ============================================================

  const [fotos, setFotos] = useState<Asset[]>([]);
  const [indice, setIndice] = useState(0);
  const [uriAtual, setUriAtual] = useState<string | null>(null);

  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);

  const [albuns, setAlbuns] = useState<Album[]>([]);
  const [nomesAlbuns, setNomesAlbuns] = useState<Record<string, string>>({});
  const [mostrarAlbuns, setMostrarAlbuns] = useState(false);

  const [mostrarCriarAlbum, setMostrarCriarAlbum] = useState(false);
  const [nomeNovoAlbum, setNomeNovoAlbum] = useState('');

  // ============================================================
  // REFS
  // ============================================================

  const posicao = useRef(new Animated.ValueXY()).current;

  const processandoSwipe = useRef(false);

  // Essas refs mantêm SEMPRE a lista atual.
  // Isso evita o problema do PanResponder usar estado antigo.
  const fotosRef = useRef<Asset[]>([]);
  const indiceRef = useRef(0);

  // ============================================================
  // INICIAR
  // ============================================================

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setCarregando(true);

      let permissao = await getPermissionsAsync();

      // Só pergunta se ainda não foi decidido.
      if (permissao.status === 'undetermined') {
        permissao = await requestPermissionsAsync();
      }

      if (!permissao.granted) {
        setMensagem('❌ Preciso de acesso às suas fotos.');
        setCarregando(false);
        return;
      }

      if (
        'accessPrivileges' in permissao &&
        permissao.accessPrivileges !== 'all'
      ) {
        setMensagem(
          '⚠️ Dê acesso completo às fotos nas configurações do iPhone.'
        );
        setCarregando(false);
        return;
      }

      await carregarFotos();

    } catch (erro) {
      console.log('ERRO AO INICIAR:', erro);

      setMensagem(
        '❌ Erro ao acessar suas fotos.'
      );

      setCarregando(false);
    }
  }

  // ============================================================
  // CARREGAR FOTOS
  // ============================================================

  async function carregarFotos() {
    try {
      const resultado = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .limit(100)
        .orderBy({
          key: AssetField.CREATION_TIME,
          ascending: false,
        })
        .exe();

      fotosRef.current = resultado;
      indiceRef.current = 0;

      setFotos(resultado);
      setIndice(0);

      if (resultado.length > 0) {
        const info = await resultado[0].getInfo();
        setUriAtual(info.uri);
      } else {
        setUriAtual(null);
      }

      setMensagem('');

    } catch (erro) {
      console.log('ERRO AO CARREGAR FOTOS:', erro);

      setMensagem(
        '❌ Não consegui carregar as fotos.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // ============================================================
  // MOSTRAR FOTO
  // ============================================================

  async function mostrarFoto(
    lista: Asset[],
    novoIndice: number
  ) {
    if (
      lista.length === 0 ||
      !lista[novoIndice]
    ) {
      setUriAtual(null);
      return;
    }

    try {
      const info = await lista[novoIndice].getInfo();

      setUriAtual(info.uri);

    } catch (erro) {
      console.log(
        'ERRO AO MOSTRAR FOTO:',
        erro
      );

      setUriAtual(null);
    }
  }

  // ============================================================
  // EXCLUIR FOTO
  // ============================================================

  async function excluirFoto(foto: Asset) {
    console.log(
      '🗑️ TENTANDO EXCLUIR:',
      foto.id
    );

    try {
      // Usa a API atual do expo-media-library.
      await foto.delete();

      console.log(
        '✅ FOTO EXCLUÍDA DO IPHONE!'
      );

      setMensagem(
        '🗑️ Foto excluída!'
      );

      return true;

    } catch (erro) {
      console.log(
        '❌ ERRO AO EXCLUIR:',
        erro
      );

      setMensagem(
        '❌ Não consegui excluir a foto.'
      );

      return false;
    }
  }

  // ============================================================
  // REMOVER FOTO DA INTERFACE
  // ============================================================

  async function removerDaInterface(
    foto: Asset
  ) {
    const listaAtual = fotosRef.current;

    const novaLista = listaAtual.filter(
      (item) => item.id !== foto.id
    );

    fotosRef.current = novaLista;

    setFotos(novaLista);

    if (novaLista.length === 0) {
      indiceRef.current = 0;

      setIndice(0);
      setUriAtual(null);

      return;
    }

    let novoIndice = indiceRef.current;

    if (novoIndice >= novaLista.length) {
      novoIndice = novaLista.length - 1;
    }

    indiceRef.current = novoIndice;

    setIndice(novoIndice);

    await mostrarFoto(
      novaLista,
      novoIndice
    );
  }

  // ============================================================
  // ÁLBUNS
  // ============================================================

  async function abrirAlbuns() {
    try {
      const lista = await Album.getAll();

      setAlbuns(lista);

      const nomes: Record<string, string> = {};

      for (const album of lista) {
        try {
          nomes[album.id] =
            await album.getTitle();
        } catch {
          nomes[album.id] = 'Álbum';
        }
      }

      setNomesAlbuns(nomes);

      setMostrarAlbuns(true);

    } catch (erro) {
      console.log(
        'ERRO AO ABRIR ÁLBUNS:',
        erro
      );

      setMensagem(
        '❌ Não consegui abrir os álbuns.'
      );
    }
  }

  // ============================================================
  // ADICIONAR AO ÁLBUM
  // ============================================================

  async function adicionarNoAlbum(
    album: Album
  ) {
    const fotoAtual =
      fotosRef.current[indiceRef.current];

    if (!fotoAtual) {
      return;
    }

    try {
      await album.add([
        fotoAtual,
      ]);

      setMostrarAlbuns(false);

      // A foto continua na galeria, mas sai da fila do app
      // e a próxima foto passa a ser mostrada.
      await removerDaInterface(fotoAtual);

      setMensagem(
        `📁 Foto adicionada em "${
          nomesAlbuns[album.id] || 'álbum'
        }"!`
      );

    } catch (erro) {
      console.log(
        'ERRO AO ADICIONAR NO ÁLBUM:',
        erro
      );

      setMensagem(
        '❌ Não consegui adicionar ao álbum.'
      );
    }
  }

  // ============================================================
  // CRIAR ÁLBUM
  // ============================================================

  async function criarAlbum() {
    const nome =
      nomeNovoAlbum.trim();

    const fotoAtual =
      fotosRef.current[indiceRef.current];

    if (!nome) {
      Alert.alert(
        'Digite um nome',
        'Digite um nome para o álbum.'
      );

      return;
    }

    if (!fotoAtual) {
      return;
    }

    try {
      await Album.create(
        nome,
        [fotoAtual]
      );

      setMostrarCriarAlbum(false);
      setMostrarAlbuns(false);

      setNomeNovoAlbum('');

      // A foto continua na galeria, mas sai da fila do app
      // e a próxima foto passa a ser mostrada.
      await removerDaInterface(fotoAtual);

      setMensagem(
        `📁 Álbum "${nome}" criado!`
      );

    } catch (erro) {
      console.log(
        'ERRO AO CRIAR ÁLBUM:',
        erro
      );

      setMensagem(
        '❌ Não consegui criar o álbum.'
      );
    }
  }

  // ============================================================
  // SWIPE
  // ============================================================

  function sairDaTela(
    direcao: 'esquerda' | 'direita'
  ) {
    if (processandoSwipe.current) {
      return;
    }

    const listaAtual =
      fotosRef.current;

    const indiceAtual =
      indiceRef.current;

    const fotoAtual =
      listaAtual[indiceAtual];

    if (!fotoAtual) {
      return;
    }

    processandoSwipe.current = true;

    const distancia =
      direcao === 'direita'
        ? 500
        : -500;

    Animated.timing(posicao, {
      toValue: {
        x: distancia,
        y: 0,
      },

      duration: 250,

      useNativeDriver: true,

    }).start(async () => {

      // ========================================================
      // ESQUERDA = APAGAR
      // ========================================================

      if (direcao === 'esquerda') {

        // Primeiro apaga do iPhone.
        const apagou = await excluirFoto(
          fotoAtual
        );

        // Só remove da interface se o iPhone confirmou a exclusão.
        if (apagou) {
          await removerDaInterface(
            fotoAtual
          );
        }

      }

      // ========================================================
      // DIREITA = ÁLBUM
      // ========================================================

      else {

        // Volta a carta para o centro.
        posicao.setValue({
          x: 0,
          y: 0,
        });

        await abrirAlbuns();
      }

      // ========================================================
      // LIBERA O PRÓXIMO SWIPE
      // ========================================================

      posicao.setValue({
        x: 0,
        y: 0,
      });

      processandoSwipe.current =
        false;
    });
  }

  // ============================================================
  // PAN RESPONDER
  // ============================================================

  const panResponder = useRef(
    PanResponder.create({

      onMoveShouldSetPanResponder: (
        _,
        gesture
      ) => {
        return (
          Math.abs(gesture.dx) > 10
        );
      },

      onPanResponderMove: (
        _,
        gesture
      ) => {

        posicao.setValue({
          x: gesture.dx,
          y: gesture.dy * 0.1,
        });

      },

      onPanResponderRelease: (
        _,
        gesture
      ) => {

        if (gesture.dx > 120) {

          // DIREITA
          sairDaTela(
            'direita'
          );

        } else if (
          gesture.dx < -120
        ) {

          // ESQUERDA
          sairDaTela(
            'esquerda'
          );

        } else {

          // Não foi um swipe suficiente.
          Animated.spring(
            posicao,
            {
              toValue: {
                x: 0,
                y: 0,
              },

              tension: 50,
              friction: 8,

              useNativeDriver: true,
            }
          ).start();

        }
      },

      onPanResponderTerminate: () => {

        Animated.spring(
          posicao,
          {
            toValue: {
              x: 0,
              y: 0,
            },

            useNativeDriver: true,
          }
        ).start();

        processandoSwipe.current =
          false;
      },
    })
  ).current;

  // ============================================================
  // ROTAÇÃO
  // ============================================================

  const rotacao =
    posicao.x.interpolate({
      inputRange: [
        -300,
        0,
        300,
      ],

      outputRange: [
        '-12deg',
        '0deg',
        '12deg',
      ],
    });

  // ============================================================
  // FOTO ATUAL
  // ============================================================

  const fotoAtual =
    fotos[indice];

  // ============================================================
  // CARREGANDO
  // ============================================================

  if (carregando) {
    return (
      <View style={styles.tela}>
        <Text style={styles.carregando}>
          Carregando suas fotos...
        </Text>
      </View>
    );
  }

  // ============================================================
  // TELA PRINCIPAL
  // ============================================================

  return (
    <View style={styles.tela}>

      <Text style={styles.titulo}>
        Galeria Tinder
      </Text>

      <Text style={styles.contador}>
        {fotos.length > 0
          ? `${indice + 1} / ${fotos.length}`
          : '0 fotos'}
      </Text>

      {mensagem !== '' && (
        <Text style={styles.mensagem}>
          {mensagem}
        </Text>
      )}

      {/* ======================================================
          FOTO
         ====================================================== */}

      {fotoAtual &&
      uriAtual ? (

        <Animated.View
          {...panResponder.panHandlers}

          style={[
            styles.card,

            {
              transform: [
                {
                  translateX:
                    posicao.x,
                },

                {
                  translateY:
                    posicao.y,
                },

                {
                  rotate:
                    rotacao,
                },
              ],
            },
          ]}
        >

          <Image
            source={{
              uri: uriAtual,
            }}

            style={styles.foto}

            resizeMode="cover"
          />

          {/* ESQUERDA */}

          <Animated.View
            style={[
              styles.indicadorEsquerda,

              {
                opacity:
                  posicao.x.interpolate({
                    inputRange: [
                      -150,
                      0,
                    ],

                    outputRange: [
                      1,
                      0,
                    ],

                    extrapolate:
                      'clamp',
                  }),
              },
            ]}
          >

            <Text
              style={
                styles.indicadorTexto
              }
            >
              🗑️ APAGAR
            </Text>

          </Animated.View>

          {/* DIREITA */}

          <Animated.View
            style={[
              styles.indicadorDireita,

              {
                opacity:
                  posicao.x.interpolate({
                    inputRange: [
                      0,
                      150,
                    ],

                    outputRange: [
                      0,
                      1,
                    ],

                    extrapolate:
                      'clamp',
                  }),
              },
            ]}
          >

            <Text
              style={
                styles.indicadorTexto
              }
            >
              📁 ÁLBUM
            </Text>

          </Animated.View>

        </Animated.View>

      ) : (

        <View
          style={
            styles.semFotos
          }
        >

          <Text
            style={
              styles.semFotosTexto
            }
          >
            🎉
          </Text>

          <Text
            style={
              styles.semFotosTitulo
            }
          >
            Acabaram as fotos!
          </Text>

          <Text
            style={
              styles.semFotosSubtitulo
            }
          >
            Não tem mais fotos
            para organizar.
          </Text>

        </View>
      )}

      {/* INSTRUÇÃO */}

      {fotoAtual && (
        <Text
          style={styles.instrucao}
        >
          ← deslize para apagar
          {'\n'}
          deslize para adicionar ao álbum →
        </Text>
      )}

      {/* ======================================================
          MODAL DOS ÁLBUNS
         ====================================================== */}

      <Modal
        visible={mostrarAlbuns}
        transparent
        animationType="slide"

        onRequestClose={() =>
          setMostrarAlbuns(false)
        }
      >

        <View
          style={
            styles.fundoModal
          }
        >

          <View
            style={styles.modal}
          >

            <Text
              style={
                styles.modalTitulo
              }
            >
              Escolha um álbum
            </Text>

            <TouchableOpacity
              style={
                styles.botaoCriar
              }

              onPress={() =>
                setMostrarCriarAlbum(
                  true
                )
              }
            >

              <Text
                style={
                  styles.botaoCriarTexto
                }
              >
                ＋ Criar novo álbum
              </Text>

            </TouchableOpacity>

            <View
              style={styles.linha}
            />

            {albuns.length === 0 ? (

              <Text
                style={
                  styles.semAlbuns
                }
              >
                Você ainda não
                tem álbuns.
              </Text>

            ) : (

              albuns.map(
                (album) => (

                  <TouchableOpacity
                    key={album.id}

                    style={
                      styles.album
                    }

                    onPress={() =>
                      adicionarNoAlbum(
                        album
                      )
                    }
                  >

                    <Text
                      style={
                        styles.albumIcone
                      }
                    >
                      📁
                    </Text>

                    <Text
                      style={
                        styles.albumNome
                      }
                    >
                      {nomesAlbuns[
                        album.id
                      ] || 'Álbum'}
                    </Text>

                  </TouchableOpacity>

                )
              )
            )}

            <TouchableOpacity
              style={
                styles.botaoFechar
              }

              onPress={() =>
                setMostrarAlbuns(
                  false
                )
              }
            >

              <Text
                style={
                  styles.botaoFecharTexto
                }
              >
                Cancelar
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

      {/* ======================================================
          CRIAR ÁLBUM
         ====================================================== */}

      <Modal
        visible={
          mostrarCriarAlbum
        }

        transparent
        animationType="fade"

        onRequestClose={() =>
          setMostrarCriarAlbum(
            false
          )
        }
      >

        <View
          style={
            styles.fundoModal
          }
        >

          <View
            style={
              styles.modalCriar
            }
          >

            <Text
              style={
                styles.modalTitulo
              }
            >
              Novo álbum
            </Text>

            <TextInput
              value={
                nomeNovoAlbum
              }

              onChangeText={
                setNomeNovoAlbum
              }

              placeholder="Nome do álbum"

              placeholderTextColor="#888"

              style={styles.input}

              autoFocus
            />

            <TouchableOpacity
              style={
                styles.botaoConfirmar
              }

              onPress={
                criarAlbum
              }
            >

              <Text
                style={
                  styles.botaoConfirmarTexto
                }
              >
                Criar álbum
              </Text>

            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.botaoCancelarCriar
              }

              onPress={() => {

                setMostrarCriarAlbum(
                  false
                );

                setNomeNovoAlbum(
                  ''
                );

              }}
            >

              <Text
                style={
                  styles.botaoCancelarTexto
                }
              >
                Cancelar
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({

  tela: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    paddingTop: 65,
  },

  titulo: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },

  contador: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 5,
  },

  mensagem: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  carregando: {
    color: '#fff',
    fontSize: 18,
    marginTop: 300,
  },

  card: {
    position: 'absolute',
    top: 150,
    width: '90%',
    height: '62%',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#222',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },

  foto: {
    width: '100%',
    height: '100%',
  },

  indicadorEsquerda: {
    position: 'absolute',
    top: 30,
    left: 25,

    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 10,

    paddingHorizontal: 12,
    paddingVertical: 8,

    transform: [
      {
        rotate: '-10deg',
      },
    ],
  },

  indicadorDireita: {
    position: 'absolute',
    top: 30,
    right: 25,

    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 10,

    paddingHorizontal: 12,
    paddingVertical: 8,

    transform: [
      {
        rotate: '10deg',
      },
    ],
  },

  indicadorTexto: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },

  instrucao: {
    position: 'absolute',
    bottom: 45,

    color: '#777',
    textAlign: 'center',

    fontSize: 13,
    lineHeight: 20,
  },

  semFotos: {
    position: 'absolute',
    top: 250,
    alignItems: 'center',
  },

  semFotosTexto: {
    fontSize: 60,
  },

  semFotosTitulo: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 15,
  },

  semFotosSubtitulo: {
    color: '#888',
    fontSize: 15,
    marginTop: 8,
  },

  fundoModal: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: '#1c1c1c',

    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,

    padding: 25,
    maxHeight: '80%',
  },

  modalCriar: {
    backgroundColor: '#1c1c1c',

    borderRadius: 25,

    padding: 25,

    marginHorizontal: 25,
    marginBottom: 200,
  },

  modalTitulo: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },

  botaoCriar: {
    backgroundColor: '#292929',

    padding: 15,

    borderRadius: 12,

    marginBottom: 15,
  },

  botaoCriarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  linha: {
    height: 1,
    backgroundColor: '#333',
    marginBottom: 10,
  },

  album: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 15,

    borderBottomWidth: 1,
    borderBottomColor: '#292929',
  },

  albumIcone: {
    fontSize: 25,
    marginRight: 15,
  },

  albumNome: {
    color: '#fff',
    fontSize: 17,
  },

  semAlbuns: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },

  botaoFechar: {
    marginTop: 20,

    backgroundColor: '#333',

    padding: 15,

    borderRadius: 12,

    alignItems: 'center',
  },

  botaoFecharTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  input: {
    backgroundColor: '#292929',

    color: '#fff',

    borderRadius: 12,

    paddingHorizontal: 15,
    paddingVertical: 13,

    fontSize: 16,

    marginBottom: 15,
  },

  botaoConfirmar: {
    backgroundColor: '#fff',

    padding: 15,

    borderRadius: 12,

    alignItems: 'center',
  },

  botaoConfirmarTexto: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },

  botaoCancelarCriar: {
    padding: 15,
    alignItems: 'center',
  },

  botaoCancelarTexto: {
    color: '#aaa',
    fontSize: 16,
  },

});